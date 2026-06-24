import type { Express, Request } from 'express';
import express from 'express';

import { mountAccountBridgeGateway } from '@account-bridge/adapters/express';
import {
  createPlatformSubscriptionCheckout,
  handlePlatformSubscriptionWebhook,
  type PlatformStripeConfig,
} from '@account-bridge/billing';
import { createServerBridgeFactory } from '@account-bridge/core/node';
import {
  getPlan,
  planAllowsRequest,
  PLATFORM_PLANS,
  type PlatformApp,
  type PlatformStore,
  type PlanId,
} from '@account-bridge/platform';

import { mountAccountBridgeHostRoutes } from './hostRoutes.js';
import { stripeWebhookRawBody } from './stripeWebhook.js';

export interface MountPlatformServiceOptions {
  app: Express;
  store: PlatformStore;
  /** Public origin, e.g. https://api.accountbridge.dev */
  baseUrl: string;
  stripe?: PlatformStripeConfig;
  /** Demo consumer auth — replace with host JWT validation in production */
  resolveConsumerUser?: (req: {
    headers: Record<string, string | string[] | undefined>;
  }) => Promise<string | null> | string | null;
}

const registeredSlugs = new WeakMap<Express, Set<string>>();

function tenantPath(slug: string): string {
  return `/t/${slug}`;
}

function extractSecretKey(req: Request): string | null {
  const auth = String(req.headers.authorization ?? '');
  if (auth.startsWith('Bearer ab_sk_')) return auth.slice('Bearer '.length).trim();
  return null;
}

function extractPublishableKey(req: Request): string | null {
  const header = req.headers['x-account-bridge-publishable-key'];
  if (typeof header === 'string' && header.startsWith('ab_pk_')) return header.trim();
  return null;
}

function registerTenantRouter(
  rootApp: Express,
  platformApp: PlatformApp,
  options: MountPlatformServiceOptions,
): void {
  let slugs = registeredSlugs.get(rootApp);
  if (!slugs) {
    slugs = new Set();
    registeredSlugs.set(rootApp, slugs);
  }
  if (slugs.has(platformApp.slug)) return;
  slugs.add(platformApp.slug);

  const tenantBase = `${options.baseUrl.replace(/\/$/, '')}${tenantPath(platformApp.slug)}`;
  const router = express.Router();
  router.use(express.json());

  const createBridgeFactory = createServerBridgeFactory({
    appId: platformApp.slug,
    baseUrl: tenantBase,
    getAuthHeaders: () => ({}),
    encryptionSecret: platformApp.encryptionSecret,
    fundingPolicy: platformApp.fundingPolicy,
    storageKind: 'memory',
  });

  async function assertTenantAccess(req: Request, app: PlatformApp): Promise<boolean> {
    const secret = extractSecretKey(req);
    if (secret) {
      const resolved = await options.store.findAppBySecretKey(secret);
      return resolved?.id === app.id;
    }
    const publishable = extractPublishableKey(req);
    if (publishable) {
      return publishable === app.publishableKey;
    }
    return false;
  }

  router.use(async (req, res, next) => {
    if (platformApp.status !== 'active') {
      res.status(403).json({ error: 'App suspended' });
      return;
    }
    const host = await options.store.findHostById(platformApp.hostId);
    if (!host || host.planStatus === 'canceled') {
      res.status(403).json({ error: 'Host subscription inactive' });
      return;
    }
    if (!(await assertTenantAccess(req, platformApp))) {
      res.status(401).json({
        error: 'Missing or invalid app credentials. Use X-Account-Bridge-Publishable-Key or Bearer ab_sk_…',
      });
      return;
    }
    if (!planAllowsRequest(host.planId, platformApp.monthlyRequestCount)) {
      res.status(429).json({ error: 'Monthly request limit reached. Upgrade your plan.' });
      return;
    }
    await options.store.incrementAppUsage(platformApp.id);
    next();
  });

  const resolveUser =
    options.resolveConsumerUser ??
    ((req: { headers: Record<string, string | string[] | undefined> }) => {
      const auth = String(req.headers.authorization ?? '');
      if (auth.startsWith('Bearer ') && !auth.startsWith('Bearer ab_sk_')) {
        return auth.slice('Bearer '.length).trim() || null;
      }
      const demo = req.headers['x-demo-user'];
      if (typeof demo === 'string' && demo.trim()) return demo.trim();
      return null;
    });

  mountAccountBridgeHostRoutes({
    app: router as unknown as Express,
    appId: platformApp.slug,
    createBridge: (userId) => createBridgeFactory(userId),
    resolveUser,
    fundingPolicy: platformApp.fundingPolicy,
    enforceConsumerCredits: true,
  });

  mountAccountBridgeGateway(router as unknown as Express, {
    appId: platformApp.slug,
    createBridge: (userId) => createBridgeFactory(userId),
    resolveUser,
    fundingPolicy: platformApp.fundingPolicy,
    enforceConsumerCredits: true,
  });

  rootApp.use(tenantPath(platformApp.slug), router);
}

async function resolveHostFromRequest(
  store: PlatformStore,
  req: Request,
): Promise<{ hostId: string } | null> {
  const auth = String(req.headers.authorization ?? '');
  if (!auth.startsWith('Bearer ab_host_')) return null;
  const host = await store.findHostByToken(auth.slice('Bearer '.length).trim());
  return host ? { hostId: host.id } : null;
}

export function mountPlatformService(options: MountPlatformServiceOptions): void {
  const { app, store, baseUrl } = options;
  const platformPrefix = '/platform/v1';
  const json = express.json();

  app.post(
    `${platformPrefix}/billing/webhook`,
    express.raw({ type: 'application/json' }),
    stripeWebhookRawBody,
    async (req, res) => {
      if (!options.stripe) {
        res.status(503).json({ error: 'Stripe not configured' });
        return;
      }
      try {
        const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
        if (!rawBody?.length) {
          res.status(400).json({ error: 'Webhook requires raw body middleware' });
          return;
        }
        const signature = String(req.headers['stripe-signature'] ?? '');
        const result = await handlePlatformSubscriptionWebhook(options.stripe, rawBody, signature);
        if (result.handled && result.hostId) {
          await store.updateHostPlan(result.hostId, {
            planId: result.planId,
            planStatus: result.planStatus,
            stripeCustomerId: result.stripeCustomerId,
            stripeSubscriptionId: result.stripeSubscriptionId,
          });
        }
        res.json({ received: true, ...result });
      } catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : 'Webhook failed' });
      }
    },
  );

  app.get(`${platformPrefix}/health`, (_req, res) => {
    res.json({ ok: true, service: 'account-bridge-platform', plans: PLATFORM_PLANS });
  });

  app.get(`${platformPrefix}/plans`, (_req, res) => {
    res.json({ plans: Object.values(PLATFORM_PLANS) });
  });

  app.post(`${platformPrefix}/signup`, json, async (req, res) => {
    try {
      const { email, name } = req.body as { email?: string; name?: string };
      if (!email?.trim()) {
        res.status(400).json({ error: 'email required' });
        return;
      }
      const result = await store.createHost({ email, name: name ?? '' });
      res.status(201).json({
        host: {
          id: result.host.id,
          email: result.host.email,
          name: result.host.name,
          planId: result.host.planId,
          planStatus: result.host.planStatus,
        },
        hostToken: result.hostToken,
        message: 'Save hostToken — it is shown once.',
      });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Signup failed' });
    }
  });

  app.get(`${platformPrefix}/me`, json, async (req, res) => {
    const ctx = await resolveHostFromRequest(store, req);
    if (!ctx) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const host = await store.findHostById(ctx.hostId);
    if (!host) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const plan = getPlan(host.planId);
    const apps = await store.listAppsForHost(host.id);
    res.json({
      host: {
        id: host.id,
        email: host.email,
        name: host.name,
        planId: host.planId,
        planStatus: host.planStatus,
      },
      plan,
      apps: apps.map((a) => ({
        id: a.id,
        slug: a.slug,
        displayName: a.displayName,
        publishableKey: a.publishableKey,
        fundingPolicy: a.fundingPolicy,
        status: a.status,
        monthlyRequestCount: a.monthlyRequestCount,
        tenantBaseUrl: `${baseUrl.replace(/\/$/, '')}${tenantPath(a.slug)}`,
      })),
    });
  });

  app.post(`${platformPrefix}/apps`, json, async (req, res) => {
    const ctx = await resolveHostFromRequest(store, req);
    if (!ctx) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    try {
      const { slug, displayName, fundingPolicy } = req.body as {
        slug?: string;
        displayName?: string;
        fundingPolicy?: PlatformApp['fundingPolicy'];
      };
      if (!slug?.trim()) {
        res.status(400).json({ error: 'slug required' });
        return;
      }
      const result = await store.createApp({
        hostId: ctx.hostId,
        slug,
        displayName: displayName ?? slug,
        fundingPolicy,
      });
      registerTenantRouter(app, result.app, options);
      res.status(201).json({
        app: {
          id: result.app.id,
          slug: result.app.slug,
          displayName: result.app.displayName,
          publishableKey: result.app.publishableKey,
          tenantBaseUrl: `${baseUrl.replace(/\/$/, '')}${tenantPath(result.app.slug)}`,
        },
        secretKey: result.secretKey,
        message: 'Save secretKey — it is shown once.',
      });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Create app failed' });
    }
  });

  app.post(`${platformPrefix}/billing/checkout`, json, async (req, res) => {
    const ctx = await resolveHostFromRequest(store, req);
    if (!ctx) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (!options.stripe) {
      res.status(503).json({ error: 'Stripe not configured on this platform host' });
      return;
    }
    try {
      const { planId } = req.body as { planId?: PlanId };
      if (!planId || planId === 'free') {
        res.status(400).json({ error: 'planId must be pro or business' });
        return;
      }
      const host = await store.findHostById(ctx.hostId);
      if (!host) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const checkout = await createPlatformSubscriptionCheckout(options.stripe, {
        hostId: host.id,
        email: host.email,
        planId,
      });
      res.json(checkout);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Checkout failed' });
    }
  });
}

/** Register tenant routers for all apps already in the store (startup). */
export async function registerExistingPlatformApps(
  options: MountPlatformServiceOptions,
): Promise<void> {
  const allApps = await options.store.listAllApps();
  for (const platformApp of allApps) {
    registerTenantRouter(options.app, platformApp, options);
  }
}

export { tenantPath };
