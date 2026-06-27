import type {
  CreateAppParams,
  CreateAppResult,
  CreateHostParams,
  CreateHostResult,
  PlatformApp,
  PlatformHost,
  PlatformStore,
  RotateAppSecretResult,
  UpdateAppParams,
} from './types.js';
import {
  normalizeAppSlug,
  parseFundingPolicyInput,
  validateAppDisplayName,
  validateAppSlug,
  validateHostDisplayName,
  validatePlatformEmail,
} from './validation.js';
import {
  generateEncryptionSecret,
  generateHostToken,
  generatePublishableKey,
  generateSecretKey,
  hashApiKey,
  newPlatformId,
} from './apiKeys.js';
import { assertFundingPolicyAllowed } from './fundingPolicy.js';

export function memoryPlatformStore(): PlatformStore & PlatformStoreSnapshotOps {
  const hosts = new Map<string, PlatformHost>();
  const hostByEmail = new Map<string, string>();
  const hostByTokenHash = new Map<string, string>();
  const apps = new Map<string, PlatformApp>();
  const appBySlug = new Map<string, string>();
  const appByPublishable = new Map<string, string>();
  const appBySecretHash = new Map<string, string>();

  function rebuildIndexes(): void {
    hostByEmail.clear();
    hostByTokenHash.clear();
    appBySlug.clear();
    appByPublishable.clear();
    appBySecretHash.clear();
    for (const host of hosts.values()) {
      hostByEmail.set(host.email, host.id);
      hostByTokenHash.set(host.hostTokenHash, host.id);
    }
    for (const app of apps.values()) {
      appBySlug.set(app.slug, app.id);
      appByPublishable.set(app.publishableKey, app.id);
      appBySecretHash.set(app.secretKeyHash, app.id);
    }
  }

  const store: PlatformStore & PlatformStoreSnapshotOps = {
    async createHost(params: CreateHostParams): Promise<CreateHostResult> {
      const email = validatePlatformEmail(params.email);
      if (hostByEmail.has(email)) {
        throw new Error('Unable to create account. Sign in or use a different email.');
      }
      const hostToken = generateHostToken();
      const host: PlatformHost = {
        id: newPlatformId('host'),
        email,
        name: validateHostDisplayName(params.name) || email.split('@')[0] || 'Host',
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

      const slug = validateAppSlug(params.slug);
      if (appBySlug.has(slug)) throw new Error('App slug already taken.');

      const hostApps = [...apps.values()].filter((a) => a.hostId === params.hostId);
      const { getPlan } = await import('./plans.js');
      const plan = getPlan(host.planId);
      if (hostApps.length >= plan.maxApps) {
        throw new Error(`Plan limit: ${plan.maxApps} app(s). Upgrade to add more.`);
      }

      const fundingPolicy = parseFundingPolicyInput(params.fundingPolicy) ?? { mode: 'byok' };
      assertFundingPolicyAllowed(plan, fundingPolicy);

      const secretKey = generateSecretKey();
      const app: PlatformApp = {
        id: newPlatformId('app'),
        hostId: params.hostId,
        slug,
        displayName: validateAppDisplayName(params.displayName, slug),
        publishableKey: generatePublishableKey(),
        secretKeyHash: hashApiKey(secretKey),
        encryptionSecret: generateEncryptionSecret(),
        fundingPolicy,
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

    async updateApp(params: UpdateAppParams): Promise<PlatformApp> {
      const host = hosts.get(params.hostId);
      if (!host) throw new Error('Host not found');

      const slug = validateAppSlug(params.slug);
      const appId = appBySlug.get(slug);
      if (!appId) throw new Error('App not found');
      const app = apps.get(appId);
      if (!app || app.hostId !== params.hostId) throw new Error('App not found');

      const { getPlan } = await import('./plans.js');
      const plan = getPlan(host.planId);
      const fundingPolicy =
        params.fundingPolicy !== undefined
          ? (parseFundingPolicyInput(params.fundingPolicy) ?? app.fundingPolicy)
          : app.fundingPolicy;
      assertFundingPolicyAllowed(plan, fundingPolicy);

      const updated: PlatformApp = {
        ...app,
        displayName:
          params.displayName !== undefined
            ? validateAppDisplayName(params.displayName, app.slug)
            : app.displayName,
        fundingPolicy,
      };
      apps.set(appId, updated);
      return updated;
    },

    async rotateAppSecret(hostId: string, slug: string): Promise<RotateAppSecretResult> {
      const normalized = validateAppSlug(slug);
      const appId = appBySlug.get(normalized);
      if (!appId) throw new Error('App not found');
      const app = apps.get(appId);
      if (!app || app.hostId !== hostId) throw new Error('App not found');

      appBySecretHash.delete(app.secretKeyHash);
      const secretKey = generateSecretKey();
      const updated: PlatformApp = {
        ...app,
        secretKeyHash: hashApiKey(secretKey),
      };
      apps.set(appId, updated);
      appBySecretHash.set(updated.secretKeyHash, appId);
      return { app: updated, secretKey };
    },

    async listAppsForHost(hostId: string): Promise<PlatformApp[]> {
      return [...apps.values()].filter((a) => a.hostId === hostId);
    },

    async findAppBySlug(slug: string): Promise<PlatformApp | null> {
      const id = appBySlug.get(normalizeAppSlug(slug));
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

    exportSnapshot(): PlatformStoreSnapshot {
      return {
        hosts: [...hosts.values()],
        apps: [...apps.values()],
      };
    },

    importSnapshot(snapshot: PlatformStoreSnapshot): void {
      hosts.clear();
      apps.clear();
      for (const host of snapshot.hosts) {
        hosts.set(host.id, host);
      }
      for (const app of snapshot.apps) {
        apps.set(app.id, app);
      }
      rebuildIndexes();
    },
  };

  return store;
}

export interface PlatformStoreSnapshot {
  hosts: PlatformHost[];
  apps: PlatformApp[];
}

export interface PlatformStoreSnapshotOps {
  exportSnapshot(): PlatformStoreSnapshot;
  importSnapshot(snapshot: PlatformStoreSnapshot): void;
}
