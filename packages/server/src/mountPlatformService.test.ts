import express from 'express';
import { describe, expect, it } from 'vitest';

import { memoryPlatformStore } from '@account-bridge/platform';

import { mountPlatformService, registerExistingPlatformApps } from './mountPlatformService.js';

function listen(app: express.Express): Promise<{ baseUrl: string; close: () => void }> {
  return new Promise((resolve) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      resolve({
        baseUrl: `http://127.0.0.1:${port}`,
        close: () => server.close(),
      });
    });
  });
}

describe('mountPlatformService hardening', () => {
  it('requires resolveConsumerUser when demoMode is false', () => {
    const app = express();
    const store = memoryPlatformStore();
    expect(() =>
      mountPlatformService({ app, store, baseUrl: 'http://127.0.0.1:1', demoMode: false }),
    ).toThrow(/resolveConsumerUser is required/);
  });

  it('rejects tenant requests without publishable key', async () => {
    const app = express();
    const store = memoryPlatformStore();
    mountPlatformService({
      app,
      store,
      baseUrl: 'http://127.0.0.1:1',
      demoMode: true,
    });
    const { host } = await store.createHost({ email: 'tenant@test.local', name: 'T' });
    const { app: tenantApp } = await store.createApp({
      hostId: host.id,
      slug: 'secure-app',
      displayName: 'Secure',
    });
    await registerExistingPlatformApps({
      app,
      store,
      baseUrl: 'http://127.0.0.1:1',
      demoMode: true,
    });

    const { baseUrl, close } = await listen(app);
    try {
      const res = await fetch(`${baseUrl}/t/${tenantApp.slug}/account-bridge/status`, {
        headers: { Authorization: 'Bearer user-1' },
      });
      expect(res.status).toBe(401);
    } finally {
      close();
    }
  });

  it('enforces account-wide monthly quota', async () => {
    const app = express();
    const store = memoryPlatformStore();
    mountPlatformService({
      app,
      store,
      baseUrl: 'http://127.0.0.1:1',
      demoMode: true,
    });
    const { host } = await store.createHost({ email: 'quota@test.local', name: 'Q' });
    const { app: tenantApp } = await store.createApp({
      hostId: host.id,
      slug: 'quota-app',
      displayName: 'Quota',
    });
    for (let i = 0; i < 5000; i += 1) {
      await store.incrementAppUsage(tenantApp.id);
    }
    await registerExistingPlatformApps({
      app,
      store,
      baseUrl: 'http://127.0.0.1:1',
      demoMode: true,
    });

    const { baseUrl, close } = await listen(app);
    try {
      const res = await fetch(`${baseUrl}/t/${tenantApp.slug}/account-bridge/status`, {
        headers: {
          Authorization: 'Bearer user-1',
          'X-Account-Bridge-Publishable-Key': tenantApp.publishableKey,
        },
      });
      expect(res.status).toBe(429);
    } finally {
      close();
    }
  });

  it('rejects tenant health without publishable key', async () => {
    const app = express();
    const store = memoryPlatformStore();
    mountPlatformService({ app, store, baseUrl: 'http://127.0.0.1:1', demoMode: true });
    const { host } = await store.createHost({ email: 'health@test.local', name: 'H' });
    const { app: tenantApp } = await store.createApp({
      hostId: host.id,
      slug: 'health-gate',
      displayName: 'Health Gate',
    });
    await registerExistingPlatformApps({
      app,
      store,
      baseUrl: 'http://127.0.0.1:1',
      demoMode: true,
    });

    const { baseUrl, close } = await listen(app);
    try {
      const res = await fetch(`${baseUrl}/t/${tenantApp.slug}/health`);
      expect(res.status).toBe(401);
    } finally {
      close();
    }
  });

  it('blocks host A from patching host B app', async () => {
    const app = express();
    const store = memoryPlatformStore();
    mountPlatformService({ app, store, baseUrl: 'http://127.0.0.1:1', demoMode: true });

    const hostA = await store.createHost({ email: 'a@test.local', name: 'A' });
    const hostB = await store.createHost({ email: 'b@test.local', name: 'B' });
    await store.createApp({ hostId: hostB.host.id, slug: 'shared-slug', displayName: 'B App' });

    const { baseUrl, close } = await listen(app);
    try {
      const res = await fetch(`${baseUrl}/platform/v1/apps/shared-slug`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${hostA.hostToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ displayName: 'Hijacked' }),
      });
      expect(res.status).toBe(400);
    } finally {
      close();
    }
  });

  it('invalidates rotated secret keys', async () => {
    const app = express();
    const store = memoryPlatformStore();
    mountPlatformService({ app, store, baseUrl: 'http://127.0.0.1:1', demoMode: true });
    const { host, hostToken } = await store.createHost({
      email: 'rotate2@test.local',
      name: 'Rotate2',
    });
    const { app: tenantApp, secretKey: firstSecret } = await store.createApp({
      hostId: host.id,
      slug: 'rotate-app',
      displayName: 'Rotate App',
    });
    await registerExistingPlatformApps({
      app,
      store,
      baseUrl: 'http://127.0.0.1:1',
      demoMode: true,
    });

    const { baseUrl, close } = await listen(app);
    try {
      const rotateRes = await fetch(`${baseUrl}/platform/v1/apps/rotate-app/rotate-secret`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${hostToken}` },
      });
      expect(rotateRes.ok).toBe(true);
      const rotated = await rotateRes.json();
      expect(rotated.secretKey).not.toBe(firstSecret);

      const oldRes = await fetch(`${baseUrl}/t/${tenantApp.slug}/account-bridge/status`, {
        headers: {
          Authorization: `Bearer ${firstSecret}`,
          'X-Demo-User': 'svc',
        },
      });
      expect(oldRes.status).toBe(401);

      const newRes = await fetch(`${baseUrl}/t/${tenantApp.slug}/account-bridge/status`, {
        headers: {
          Authorization: `Bearer ${rotated.secretKey}`,
          'X-Demo-User': 'svc',
        },
      });
      expect(newRes.status).toBe(200);
    } finally {
      close();
    }
  });
});
