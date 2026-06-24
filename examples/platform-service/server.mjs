import express from 'express';

import { memoryPlatformStore } from '@account-bridge/platform';
import { mountPlatformService, registerExistingPlatformApps } from '@account-bridge/server';

import { createDemoCorsMiddleware } from '../shared/demo-cors.mjs';

if (process.env.NODE_ENV === 'production') {
  console.error('[platform-service] Refusing to start demo server in NODE_ENV=production');
  process.exit(1);
}

const app = express();
app.use(createDemoCorsMiddleware());

const store = memoryPlatformStore();
const HOST = process.env.HOST ?? '127.0.0.1';
const PORT = Number(process.env.PORT ?? 3460);
const SEED_DEMO = process.env.PLATFORM_SEED_DEMO !== '0';
const displayHost = HOST === '0.0.0.0' ? '127.0.0.1' : HOST;

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'platform-service',
    demoOnly: true,
    platformApi: '/platform/v1',
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

  mountPlatformService({
    app,
    store,
    baseUrl: publicUrl,
    stripe: process.env.STRIPE_SECRET_KEY
      ? {
          secretKey: process.env.STRIPE_SECRET_KEY,
          webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
          baseUrl: process.env.PLATFORM_DASHBOARD_URL ?? publicUrl,
        }
      : undefined,
  });

  let demoApp = null;
  if (SEED_DEMO) {
    const { host } = await store.createHost({
      email: 'demo@accountbridge.local',
      name: 'Demo Host',
    });
    const created = await store.createApp({
      hostId: host.id,
      slug: 'saas-demo',
      displayName: 'SaaS Walkthrough',
      fundingPolicy: { mode: 'byok' },
    });
    demoApp = created.app;
  }

  await registerExistingPlatformApps({ app, store, baseUrl: publicUrl });

  if (demoApp) {
    app.get('/platform/v1/demo-tenant', (_req, res) => {
      res.json({
        slug: demoApp.slug,
        publishableKey: demoApp.publishableKey,
        tenantBaseUrl: `${publicUrl}/t/${demoApp.slug}`,
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
    console.log(`Host dashboard: npm run demo:platform (port 5176)`);
  } else {
    console.log(`[platform-service] listening ${publicUrl} (no demo seed)`);
  }
}

bootstrap().catch((err) => {
  console.error('[platform-service] bootstrap failed', err);
  process.exit(1);
});
