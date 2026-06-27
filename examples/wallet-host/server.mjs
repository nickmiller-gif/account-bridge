import express from 'express';

import { memoryWalletStore } from '@account-bridge/billing';
import { mountAccountBridgeHost } from '@account-bridge/server';

import { createDemoCorsMiddleware } from '../shared/demo-cors.mjs';
import { createDemoHostKeyPool } from '../shared/demo-mock-ai.mjs';

if (process.env.NODE_ENV === 'production') {
  console.error('[wallet-host] Refusing to start demo server in NODE_ENV=production');
  process.exit(1);
}

const app = express();
app.use(createDemoCorsMiddleware());
app.use(express.json());

const wallet = memoryWalletStore();
const HOST = process.env.HOST ?? '127.0.0.1';
const PORT = Number(process.env.PORT ?? 3456);
const SESSION_USER = 'demo-user';
const APP_ID = 'wallet-demo';
const DEMO_MOCK = process.env.DEMO_MOCK_AI !== '0';

if (!DEMO_MOCK) {
  const poolKey = process.env.ACCOUNT_BRIDGE_POOL_OPENAI_KEY?.trim();
  if (!poolKey || poolKey.startsWith('sk-test-')) {
    console.error(
      '[wallet-host] DEMO_MOCK_AI=0 requires a real ACCOUNT_BRIDGE_POOL_OPENAI_KEY (not sk-test-*)',
    );
    process.exit(1);
  }
}

wallet.seed(SESSION_USER, APP_ID, 50_000_000);

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    appId: APP_ID,
    demoMockAi: DEMO_MOCK,
    walletSeededMicrocredits: 50_000_000,
    authHint: 'Authorization: Bearer demo',
    demoOnly: true,
  });
});

mountAccountBridgeHost({
  app,
  config: {
    appId: APP_ID,
    baseUrl: `http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`,
    encryptionSecret:
      process.env.ACCOUNT_BRIDGE_ENCRYPTION_SECRET ?? 'wallet-demo-secret-32chars-min!!',
    getAuthHeaders: () => ({}),
    fundingPolicy: {
      mode: 'auto',
      wallet: { enabled: true },
    },
  },
  wallet,
  hostKeyPool: DEMO_MOCK ? createDemoHostKeyPool() : undefined,
  resolveUser: (req) => {
    const auth = String(req.headers.authorization ?? '');
    if (auth.startsWith('Bearer demo')) return SESSION_USER;
    return null;
  },
});

app.use((err, _req, res, _next) => {
  console.error('[wallet-host]', err);
  if (res.headersSent) return;
  res.status(500).json({
    error: err instanceof Error ? err.message : 'Internal server error',
  });
});

const server = app.listen(PORT, HOST, () => {
  const displayHost = HOST === '0.0.0.0' ? '127.0.0.1' : HOST;
  const addr = server.address();
  const boundPort = typeof addr === 'object' && addr ? addr.port : PORT;
  const publicUrl = `http://${displayHost}:${boundPort}`;
  console.log(`[wallet-host] DEMO ONLY — do not deploy to production`);
  console.log(`WALLET_HOST_URL=${publicUrl}`);
  console.log(`Wallet walkthrough host ${publicUrl}`);
  console.log(`Auth: Bearer demo | Mock AI: ${DEMO_MOCK ? 'on' : 'off'} | Balance: ~$50 seeded`);
  console.log(`Pair with vite-demo → scenario 2 · App credits`);
});
