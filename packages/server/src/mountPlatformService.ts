import type { Express, Request } from 'express';
import express from 'express';

import { mountAccountBridgeGateway } from '@account-bridge/adapters/express';
import {
  createPlatformSubscriptionCheckout,
  handlePlatformSubscriptionWebhook,
  type PlatformStripeConfig,
} from '@account-bridge/billing';
import type { HostKeyPool, WalletStore } from '@account-bridge/core';
import { createHostKeyPool, createServerBridgeFactory, resolveHostProviders } from '@account-bridge/core/node';
import {
  getPlan,
  planAllowsRequest,
  PLATFORM_PLANS,
  appUsageSummary,
  hostMonthlyRequestCount,
  parseFundingPolicyInput,
  usageFromCount,
  validateAppDisplayName,
  validateHostDisplayName,
  validatePlatformEmail,
  type PlatformApp,
  type PlatformStore,
  type PlanId,
} from '@account-bridge/platform';

import { resolveDemoConsumerUser } from './demoConsumerAuth.js';
import { clientIp, createMemoryRateLimit } from './memoryRateLimit.js';
import { mountAccountBridgeHostRoutes } from './hostRoutes.js';
import { platformClientError } from './platformSafeError.js';
import { mountAccountBridgeWalletRoutes } from './walletRoutes.js';
import { stripeWebhookRawBody } from './stripeWebhook.js';

export interface MountPlatformServiceOptions {
  app: Express;
  store: PlatformStore;
  /** Public origin, e.g. https://api.accountbridge.dev */
  baseUrl: string;
  stripe?: PlatformStripeConfig;
  /** Shared wallet ledger for tenant apps (keyed by app slug + user id). */
  tenantWallet?: WalletStore;
  /** Host pool keys for wallet/auto tenant funding. */
  tenantHostKeyPool?: HostKeyPool;
  /**
   * When true, allows demo consumer auth (`Bearer` session / `X-Demo-User`).
   * Production hosts must set false and supply `resolveConsumerUser`.
   */
  demoMode?: boolean;
  /** Max JSON body size for platform + tenant routers (default 256kb). */
  jsonBodyLimit?: string;
  /** Signups allowed per IP per hour (default 20 in demo, 6 otherwise). */
  signupRateLimitPerHour?: number;
  /** Consumer auth for tenant routes — required when demoMode is not true. */
  resolveConsumerUser?: (req: {
    headers: Record<string, string | string[] | undefined>;
  }) => Promise<string | null> | string | null;
}

const registeredSlugs = new WeakMap<Express, Set<string>>();

function tenantPath(slug: string): string {
  return `/t/${slug}`;
}

function serializeHostApp(app: PlatformApp, plan: ReturnType<typeof getPlan>, baseUrl: string) {
  return {
    id: app.id,
    slug: app.slug,
    displayName: app.displayName,
    publishableKey: app.publishableKey,
    fundingPolicy: app.fundingPolicy,
    status: app.status,
    tenantBaseUrl: `${baseUrl.replace(/\/$/, '')}${tenantPath(app.slug)}`,
    usage: appUsageSummary(app, plan),
  };
}

async function resolveTenantFundingPolicy(
  store: PlatformStore,
  platformApp: PlatformApp,
): Promise<PlatformApp['fundingPolicy']> {
  const live = await store.findAppBySlug(platformApp.slug);
  return live?.fundingPolicy ?? platformApp.fundingPolicy;
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
  router.use(express.json({ limit: options.jsonBodyLimit ?? '256kb' }));
  const apiPrefix = '/account-bridge';
  const wallet = options.tenantWallet;
  const initialFundingPolicy = platformApp.fundingPolicy;
  const hostKeyPool =
    options.tenantHostKeyPool ??
    (wallet && (initialFundingPolicy.mode === 'wallet' || initialFundingPolicy.mode === 'auto')
      ? createHostKeyPool({ providers: resolveHostProviders() })
      : undefined);

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
    const liveApp = await options.store.findAppBySlug(platformApp.slug);
    if (!liveApp) {
      res.status(404).json({ error: 'Tenant app not found' });
      return;
    }
    if (liveApp.status !== 'active') {
      res.status(403).json({ error: 'App suspended' });
      return;
    }
    const host = await options.store.findHostById(liveApp.hostId);
    if (!host || host.planStatus === 'canceled' || host.planStatus === 'past_due') {
      res.status(403).json({ error: 'Host subscription inactive' });
      return;
    }
    if (!(await assertTenantAccess(req, liveApp))) {
      res.status(401).json({
        error: 'Missing or invalid app credentials. Use X-Account-Bridge-Publishable-Key or Bearer ab_sk_…',
      });
      return;
    }
    const hostUsage = await hostMonthlyRequestCount(options.store, host.id);
    if (!planAllowsRequest(host.planId, hostUsage)) {
      res.status(429).json({ error: 'Monthly request limit reached. Upgrade your plan.' });
      return;
    }

    let usageRecorded = false;
    res.on('finish', () => {
      if (usageRecorded || res.statusCode >= 400) return;
      usageRecorded = true;
      void options.store.incrementAppUsage(liveApp.id);
    });
    next();
  });

  router.get('/health', async (_req, res) => {
    const liveApp = await options.store.findAppBySlug(platformApp.slug);
    res.json({
      ok: true,
      slug: platformApp.slug,
      tenantBaseUrl: tenantBase,
      walletEnabled: Boolean(wallet),
      fundingMode: liveApp?.fundingPolicy.mode ?? initialFundingPolicy.mode,
    });
  });

  const createBridgeFactory = createServerBridgeFactory({
    appId: platformApp.slug,
    baseUrl: tenantBase,
    getAuthHeaders: () => ({}),
    encryptionSecret: platformApp.encryptionSecret,
    fundingPolicy: platformApp.fundingPolicy,
    storageKind: 'memory',
  });

  const resolveUser = options.resolveConsumerUser ?? resolveDemoConsumerUser;

  const resolveFundingPolicy = () => resolveTenantFundingPolicy(options.store, platformApp);

  mountAccountBridgeHostRoutes({
    app: router as unknown as Express,
    appId: platformApp.slug,
    apiPrefix,
    createBridge: (userId) => createBridgeFactory(userId),
    resolveUser,
    fundingPolicy: initialFundingPolicy,
    resolveFundingPolicy,
    enforceConsumerCredits: true,
    wallet,
    hostKeyPool,
  });

  mountAccountBridgeGateway(router as unknown as Express, {
    appId: platformApp.slug,
    createBridge: (userId) => createBridgeFactory(userId),
    resolveUser,
    fundingPolicy: initialFundingPolicy,
    resolveFundingPolicy,
    enforceConsumerCredits: true,
    wallet,
    hostKeyPool,
  });

  if (wallet) {
    mountAccountBridgeWalletRoutes({
      app: router as unknown as Express,
      apiPrefix,
      appId: platformApp.slug,
      wallet,
      fundingPolicy: initialFundingPolicy,
      resolveUser,
      enforceConsumerCredits: true,
    });
  }

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
  const demoMode = options.demoMode === true;
  if (!demoMode && !options.resolveConsumerUser) {
    throw new Error(
      'mountPlatformService: resolveConsumerUser is required when demoMode is not true',
    );
  }

  const { app, store, baseUrl } = options;
  const platformPrefix = '/platform/v1';
  const jsonBodyLimit = options.jsonBodyLimit ?? '256kb';
  const json = express.json({ limit: jsonBodyLimit });
  const signupLimit = createMemoryRateLimit({
    windowMs: 60 * 60 * 1000,
    max: options.signupRateLimitPerHour ?? (demoMode ? 20 : 6),
    keyFn: clientIp,
    message: 'Too many signup attempts from this address. Try again later.',
  });

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
        res.status(400).json({ error: platformClientError(err, 'Webhook failed') });
      }
    },
  );

  app.get(`${platformPrefix}/health`, (_req, res) => {
    res.json({ ok: true, service: 'account-bridge-platform', plans: PLATFORM_PLANS });
  });

  app.get(`${platformPrefix}/plans`, (_req, res) => {
    res.json({ plans: Object.values(PLATFORM_PLANS) });
  });

  app.post(`${platformPrefix}/signup`, signupLimit, json, async (req, res) => {
    try {
      const { email, name } = req.body as { email?: string; name?: string };
      if (!email?.trim()) {
        res.status(400).json({ error: 'email required' });
        return;
      }
      const result = await store.createHost({
        email: validatePlatformEmail(email),
        name: validateHostDisplayName(name ?? ''),
      });
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
      res.status(400).json({ error: platformClientError(err, 'Signup failed') });
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
    const usage = usageFromCount(
      apps.reduce((sum, app) => sum + app.monthlyRequestCount, 0),
      plan.maxMonthlyRequests,
    );
    res.json({
      host: {
        id: host.id,
        email: host.email,
        name: host.name,
        planId: host.planId,
        planStatus: host.planStatus,
      },
      plan,
      usage,
      apps: apps.map((a) => serializeHostApp(a, plan, baseUrl)),
    });
  });

  app.patch(`${platformPrefix}/apps/:slug`, json, async (req, res) => {
    const ctx = await resolveHostFromRequest(store, req);
    if (!ctx) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    try {
      const { displayName, fundingPolicy } = req.body as {
        displayName?: string;
        fundingPolicy?: PlatformApp['fundingPolicy'];
      };
      const host = await store.findHostById(ctx.hostId);
      if (!host) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const updated = await store.updateApp({
        hostId: ctx.hostId,
        slug: String(req.params.slug),
        displayName:
          displayName !== undefined ? validateAppDisplayName(displayName, String(req.params.slug)) : undefined,
        fundingPolicy: parseFundingPolicyInput(fundingPolicy),
      });
      const plan = getPlan(host.planId);
      res.json({ app: serializeHostApp(updated, plan, baseUrl) });
    } catch (err) {
      res.status(400).json({ error: platformClientError(err, 'Update app failed') });
    }
  });

  app.post(`${platformPrefix}/apps/:slug/rotate-secret`, json, async (req, res) => {
    const ctx = await resolveHostFromRequest(store, req);
    if (!ctx) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    try {
      const result = await store.rotateAppSecret(ctx.hostId, String(req.params.slug));
      const host = await store.findHostById(ctx.hostId);
      const plan = host ? getPlan(host.planId) : getPlan('free');
      res.json({
        app: serializeHostApp(result.app, plan, baseUrl),
        secretKey: result.secretKey,
        message: 'Save secretKey — previous secret is invalid.',
      });
    } catch (err) {
      res.status(400).json({ error: platformClientError(err, 'Rotate secret failed') });
    }
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
        fundingPolicy: parseFundingPolicyInput(fundingPolicy),
      });
      registerTenantRouter(app, result.app, options);
      const host = await store.findHostById(ctx.hostId);
      const plan = host ? getPlan(host.planId) : getPlan('free');
      res.status(201).json({
        app: serializeHostApp(result.app, plan, baseUrl),
        secretKey: result.secretKey,
        message: 'Save secretKey — it is shown once.',
      });
    } catch (err) {
      res.status(400).json({ error: platformClientError(err, 'Create app failed') });
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
      res.status(400).json({ error: platformClientError(err, 'Checkout failed') });
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
