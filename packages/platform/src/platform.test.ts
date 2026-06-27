import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { filePlatformStore } from './filePlatformStore.js';
import { assertFundingPolicyAllowed } from './fundingPolicy.js';
import { memoryPlatformStore } from './memoryPlatformStore.js';
import { getPlan } from './plans.js';
import { appUsageSummary, usageFromCount } from './usage.js';

describe('memoryPlatformStore', () => {
  it('creates host and app with API keys', async () => {
    const store = memoryPlatformStore();
    const { host, hostToken } = await store.createHost({
      email: 'dev@example.com',
      name: 'Dev Co',
    });
    expect(hostToken.startsWith('ab_host_')).toBe(true);

    const resolved = await store.findHostByToken(hostToken);
    expect(resolved?.id).toBe(host.id);

    const { app, secretKey } = await store.createApp({
      hostId: host.id,
      slug: 'My-App',
      displayName: 'My App',
    });
    expect(app.slug).toBe('my-app');
    expect(secretKey.startsWith('ab_sk_')).toBe(true);
    expect(app.publishableKey.startsWith('ab_pk_')).toBe(true);

    expect(await store.findAppBySecretKey(secretKey)).toMatchObject({ id: app.id });
    expect(await store.findAppByPublishableKey(app.publishableKey)).toMatchObject({ id: app.id });
  });

  it('enforces plan app limits', async () => {
    const store = memoryPlatformStore();
    const { host } = await store.createHost({ email: 'a@b.com', name: 'A' });
    await store.createApp({ hostId: host.id, slug: 'one', displayName: 'One' });
    await expect(
      store.createApp({ hostId: host.id, slug: 'two', displayName: 'Two' }),
    ).rejects.toThrow(/Plan limit/);
    expect(getPlan('free').maxApps).toBe(1);
  });

  it('updates app funding policy and display name', async () => {
    const store = memoryPlatformStore();
    const { host } = await store.createHost({ email: 'u@example.com', name: 'U' });
    await store.updateHostPlan(host.id, { planId: 'pro', planStatus: 'active' });
    await store.createApp({ hostId: host.id, slug: 'app', displayName: 'App' });
    const updated = await store.updateApp({
      hostId: host.id,
      slug: 'app',
      displayName: 'Renamed',
      fundingPolicy: { mode: 'auto', wallet: { enabled: true } },
    });
    expect(updated.displayName).toBe('Renamed');
    expect(updated.fundingPolicy.mode).toBe('auto');
  });

  it('rotates secret key hash', async () => {
    const store = memoryPlatformStore();
    const { host } = await store.createHost({ email: 'r@example.com', name: 'R' });
    const { app, secretKey: first } = await store.createApp({
      hostId: host.id,
      slug: 'rotate-me',
      displayName: 'Rotate',
    });
    const { secretKey: second } = await store.rotateAppSecret(host.id, app.slug);
    expect(first).not.toBe(second);
    expect(await store.findAppBySecretKey(first)).toBeNull();
    expect(await store.findAppBySecretKey(second)).toMatchObject({ id: app.id });
  });

  it('blocks wallet funding on free plan', async () => {
    const store = memoryPlatformStore();
    const { host } = await store.createHost({ email: 'f@example.com', name: 'F' });
    await expect(
      store.createApp({
        hostId: host.id,
        slug: 'wallet-app',
        displayName: 'Wallet',
        fundingPolicy: { mode: 'wallet', wallet: { enabled: true } },
      }),
    ).rejects.toThrow(/Pro or Business/);
  });
});

describe('usage helpers', () => {
  it('computes usage percent and remaining requests', () => {
    expect(usageFromCount(250, 1000)).toEqual({
      monthlyRequestCount: 250,
      monthlyRequestLimit: 1000,
      usagePercent: 25,
      requestsRemaining: 750,
    });
  });

  it('summarizes per-app usage against plan limits', async () => {
    const store = memoryPlatformStore();
    const { host } = await store.createHost({ email: 'usage@example.com', name: 'Usage' });
    const { app } = await store.createApp({ hostId: host.id, slug: 'usage-app', displayName: 'Usage App' });
    await store.incrementAppUsage(app.id);
    await store.incrementAppUsage(app.id);
    const live = (await store.listAppsForHost(host.id))[0]!;
    expect(appUsageSummary(live, getPlan('free')).monthlyRequestCount).toBe(2);
  });
});

describe('fundingPolicy', () => {
  it('allows BYOK on free plan', () => {
    expect(() => assertFundingPolicyAllowed(getPlan('free'), { mode: 'byok' })).not.toThrow();
  });
});

describe('filePlatformStore', () => {
  it('persists hosts and apps across instances', async () => {
    const filePath = path.join(os.tmpdir(), `ab-platform-${Date.now()}.json`);
    try {
      const store = filePlatformStore(filePath);
      const { host } = await store.createHost({ email: 'persist@example.com', name: 'Persist' });
      await store.createApp({ hostId: host.id, slug: 'persist-app', displayName: 'Persist App' });

      const reloaded = filePlatformStore(filePath);
      const apps = await reloaded.listAppsForHost(host.id);
      expect(apps).toHaveLength(1);
      expect(apps[0]?.slug).toBe('persist-app');
    } finally {
      fs.rmSync(filePath, { force: true });
    }
  });

  it('exports and imports snapshots', async () => {
    const store = memoryPlatformStore();
    const { host } = await store.createHost({ email: 'snap@example.com', name: 'Snap' });
    await store.createApp({ hostId: host.id, slug: 'snap-app', displayName: 'Snap App' });
    const snapshot = store.exportSnapshot();

    const next = memoryPlatformStore();
    next.importSnapshot(snapshot);
    const apps = await next.listAppsForHost(host.id);
    expect(apps).toHaveLength(1);
    expect(apps[0]?.slug).toBe('snap-app');
  });
});
