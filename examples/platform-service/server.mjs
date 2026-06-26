import express from 'express';

import { memoryWalletStore } from '@account-bridge/billing';
import { filePlatformStore, memoryPlatformStore } from '@account-bridge/platform';
import { mountPlatformService, registerExistingPlatformApps } from '@account-bridge/server';

import { createDemoCorsMiddleware } from '../shared/demo-cors.mjs';
import { createDemoHostKeyPool } from '../shared/demo-mock-ai.mjs';

if (process.env.NODE_ENV === 'production') {
  console.error('[platform-service] Refusing to start demo server in NODE_ENV=production');
  process.exit(1);
}

const app = express();
app.use(createDemoCorsMiddleware());

const storeFile = process.env.PLATFORM_STORE_FILE?.trim();
const store = storeFile ? filePlatformStore(storeFile) : memoryPlatformStore();
const wallet = memoryWalletStore();
const HOST = process.env.HOST ?? '127.0.0.1';
const PORT = Number(process.env.PORT ?? 3460);
const SEED_DEMO = process.env.PLATFORM_SEED_DEMO !== '0';
const DEMO_MOCK = process.env.DEMO_MOCK_AI !== '0';
const DEMO_CONSUMER = 'demo-consumer';
const DEMO_SLUG = 'saas-demo';
const displayHost = HOST === '0.0.0.0' ? '127.0.0.1' : HOST;

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'platform-service',
    demoOnly: true,
    platformApi: '/platform/v1',
    demoMockAi: DEMO_MOCK,
    store: storeFile ? 'file' : 'memory',
  });
});

app.use((err, _req, res, _next) => {
  console.error('[platform-service]', err);
  if (res.headersSent) return;
  res.status(500).json({
    error: err instanceof Error ? err.message : 'Internal server error',
  });
});

async function bootstrap() {
  const server = app.listen(PORT, HOST);
  await new Promise((resolve) => server.once('listening', resolve));

  const addr = server.address();
  const boundPort = typeof addr === 'object' && addr ? addr.port : PORT;
  const publicUrl = `http://${displayHost}:${boundPort}`;

  const platformOptions = {
    app,
    store,
    baseUrl: publicUrl,
    demoMode: true,
    tenantWallet: wallet,
    tenantHostKeyPool: DEMO_MOCK ? createDemoHostKeyPool() : undefined,
    stripe: process.env.STRIPE_SECRET_KEY
      ? {
          secretKey: process.env.STRIPE_SECRET_KEY,
          webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
          baseUrl: process.env.PLATFORM_DASHBOARD_URL ?? publicUrl,
        }
      : undefined,
  };

  mountPlatformService(platformOptions);

  let demoApp = null;
  if (SEED_DEMO) {
    let host = null;
    const existing = await store.findAppBySlug(DEMO_SLUG);
    if (existing) {
      demoApp = existing;
      host = await store.findHostById(existing.hostId);
      if (host?.planId === 'free') {
        await store.updateHostPlan(host.id, { planId: 'pro', planStatus: 'trialing' });
      }
    } else {
      const createdHost = await store.createHost({
        email: 'demo@accountbridge.local',
        name: 'Demo Host',
      });
      host = createdHost.host;
      await store.updateHostPlan(host.id, { planId: 'pro', planStatus: 'trialing' });
      const created = await store.createApp({
        hostId: host.id,
        slug: DEMO_SLUG,
        displayName: 'SaaS Walkthrough',
        fundingPolicy: { mode: 'auto', wallet: { enabled: true } },
      });
      demoApp = created.app;
    }
    if (demoApp && host) {
      wallet.seed(DEMO_CONSUMER, demoApp.slug, 50_000_000);
    }
  }

  await registerExistingPlatformApps(platformOptions);

  if (demoApp) {
    app.get('/platform/v1/demo-tenant', (_req, res) => {
      res.json({
        slug: demoApp.slug,
        publishableKey: demoApp.publishableKey,
        tenantBaseUrl: `${publicUrl}/t/${demoApp.slug}`,
        demoConsumer: DEMO_CONSUMER,
        demoMockAi: DEMO_MOCK,
      });
    });
  }

  console.log(`[platform-service] DEMO ONLY — do not deploy to production`);
  console.log(`PLATFORM_SERVICE_URL=${publicUrl}`);

  if (demoApp) {
    const tenantUrl = `${publicUrl}/t/${demoApp.slug}`;
    console.log(`PLATFORM_TENANT_URL=${tenantUrl}`);
    console.log(`PLATFORM_DEMO_PUBLISHABLE_KEY=${demoApp.publishableKey}`);
    console.log(`Platform SaaS demo ${publicUrl} · tenant ${tenantUrl}`);
    console.log(`Consumer auth: Bearer ${DEMO_CONSUMER} · Host dashboard: npm run demo:platform`);
  } else {
    console.log(`[platform-service] listening ${publicUrl} (no demo seed)`);
  }
}

bootstrap().catch((err) => {
  console.error('[platform-service] bootstrap failed', err);
  process.exit(1);
});
