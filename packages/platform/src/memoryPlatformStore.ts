import type {
  CreateAppParams,
  CreateAppResult,
  CreateHostParams,
  CreateHostResult,
  PlatformApp,
  PlatformHost,
  PlatformStore,
} from './types.js';
import {
  generateEncryptionSecret,
  generateHostToken,
  generatePublishableKey,
  generateSecretKey,
  hashApiKey,
  newPlatformId,
} from './apiKeys.js';

function normalizeSlug(slug: string): string {
  return slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function memoryPlatformStore(): PlatformStore {
  const hosts = new Map<string, PlatformHost>();
  const hostByEmail = new Map<string, string>();
  const hostByTokenHash = new Map<string, string>();
  const apps = new Map<string, PlatformApp>();
  const appBySlug = new Map<string, string>();
  const appByPublishable = new Map<string, string>();
  const appBySecretHash = new Map<string, string>();

  return {
    async createHost(params: CreateHostParams): Promise<CreateHostResult> {
      const email = params.email.trim().toLowerCase();
      if (hostByEmail.has(email)) {
        throw new Error('An account with this email already exists.');
      }
      const hostToken = generateHostToken();
      const host: PlatformHost = {
        id: newPlatformId('host'),
        email,
        name: params.name.trim() || email.split('@')[0] || 'Host',
        planId: 'free',
        planStatus: 'active',
        hostTokenHash: hashApiKey(hostToken),
        createdAt: new Date().toISOString(),
      };
      hosts.set(host.id, host);
      hostByEmail.set(email, host.id);
      hostByTokenHash.set(host.hostTokenHash, host.id);
      return { host, hostToken };
    },

    async findHostByToken(hostToken: string): Promise<PlatformHost | null> {
      const id = hostByTokenHash.get(hashApiKey(hostToken));
      return id ? (hosts.get(id) ?? null) : null;
    },

    async findHostById(hostId: string): Promise<PlatformHost | null> {
      return hosts.get(hostId) ?? null;
    },

    async updateHostPlan(hostId, patch) {
      const host = hosts.get(hostId);
      if (!host) throw new Error('Host not found');
      const updated = { ...host, ...patch };
      hosts.set(hostId, updated);
      return updated;
    },

    async createApp(params: CreateAppParams): Promise<CreateAppResult> {
      const host = hosts.get(params.hostId);
      if (!host) throw new Error('Host not found');
      if (host.planStatus === 'canceled' || host.planStatus === 'past_due') {
        throw new Error('Subscription inactive. Update billing to create apps.');
      }

      const slug = normalizeSlug(params.slug);
      if (!slug) throw new Error('App slug is required.');
      if (appBySlug.has(slug)) throw new Error('App slug already taken.');

      const hostApps = [...apps.values()].filter((a) => a.hostId === params.hostId);
      const { getPlan } = await import('./plans.js');
      const plan = getPlan(host.planId);
      if (hostApps.length >= plan.maxApps) {
        throw new Error(`Plan limit: ${plan.maxApps} app(s). Upgrade to add more.`);
      }

      const secretKey = generateSecretKey();
      const app: PlatformApp = {
        id: newPlatformId('app'),
        hostId: params.hostId,
        slug,
        displayName: params.displayName.trim() || slug,
        publishableKey: generatePublishableKey(),
        secretKeyHash: hashApiKey(secretKey),
        encryptionSecret: generateEncryptionSecret(),
        fundingPolicy: params.fundingPolicy ?? { mode: 'byok' },
        status: 'active',
        monthlyRequestCount: 0,
        createdAt: new Date().toISOString(),
      };

      apps.set(app.id, app);
      appBySlug.set(slug, app.id);
      appByPublishable.set(app.publishableKey, app.id);
      appBySecretHash.set(app.secretKeyHash, app.id);
      return { app, secretKey };
    },

    async listAppsForHost(hostId: string): Promise<PlatformApp[]> {
      return [...apps.values()].filter((a) => a.hostId === hostId);
    },

    async findAppBySlug(slug: string): Promise<PlatformApp | null> {
      const id = appBySlug.get(normalizeSlug(slug));
      return id ? (apps.get(id) ?? null) : null;
    },

    async findAppByPublishableKey(publishableKey: string): Promise<PlatformApp | null> {
      const id = appByPublishable.get(publishableKey);
      return id ? (apps.get(id) ?? null) : null;
    },

    async findAppBySecretKey(secretKey: string): Promise<PlatformApp | null> {
      const id = appBySecretHash.get(hashApiKey(secretKey));
      return id ? (apps.get(id) ?? null) : null;
    },

    async incrementAppUsage(appId: string): Promise<void> {
      const app = apps.get(appId);
      if (!app) return;
      apps.set(appId, { ...app, monthlyRequestCount: app.monthlyRequestCount + 1 });
    },

    async listAllApps(): Promise<PlatformApp[]> {
      return [...apps.values()];
    },
  };
}
