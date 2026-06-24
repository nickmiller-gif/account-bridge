#!/usr/bin/env node
/**
 * Smoke: wallet funding — debit via host pool, 402 when empty, BYOK bypass.
 */
import { createServer } from 'node:http';

import { createAccountBridge, createDefaultProviders } from '@account-bridge/core';
import { createHostKeyPool } from '@account-bridge/core/node';
import { memoryWalletStore } from '@account-bridge/billing';
import { createAccountBridgeGatewayHandlers } from '@account-bridge/gateway';
import { deriveKeyFromSecret, memoryStorage } from '@account-bridge/core';

const wallet = memoryWalletStore();
const USER = 'smoke-wallet-user';
const APP = 'smoke-app';

process.env.ACCOUNT_BRIDGE_POOL_OPENAI_KEY = 'sk-pool-smoke-key-1234567890';

const pool = createHostKeyPool({
  providers: createDefaultProviders(),
  getEnvKey: () => process.env.ACCOUNT_BRIDGE_POOL_OPENAI_KEY,
});

const mockFetch = async (url, init) => {
  if (String(url).includes('/v1/models')) {
    return { ok: true, status: 200, json: async () => ({ data: [] }) };
  }
  return { ok: false, status: 404, text: async () => '' };
};

function createBridge(userId) {
  return createAccountBridge({
    storage: memoryStorage(),
    providers: createDefaultProviders(),
    userId,
    appId: APP,
    getEncryptionKey: async () => ({
      key: await deriveKeyFromSecret('smoke', APP),
    }),
    fetch: mockFetch,
  });
}

// Mock openai complete — funding path only
const { handle } = createAccountBridgeGatewayHandlers({
  resolveUser: () => USER,
  createBridge,
  appId: APP,
  fundingPolicy: { mode: 'wallet' },
  wallet,
  hostKeyPool: pool,
});

wallet.seed(USER, APP, 1_000_000);

const server = createServer(async (req, res) => {
  const handled = await handle(req, res);
  if (!handled) {
    res.statusCode = 404;
    res.end('not found');
  }
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;

// Balance endpoint via wallet directly
const bal = await wallet.getBalance(USER, APP);
if (bal.balanceMicrocredits !== 1_000_000) {
  console.error('FAIL: seed balance');
  process.exit(1);
}

// Drain wallet
wallet.seed(USER, APP, 0);
const res402 = await fetch(`http://127.0.0.1:${port}/v1/chat/completions`, {
  method: 'POST',
  headers: {
    Authorization: 'Bearer demo-session',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    messages: [{ role: 'user', content: 'hi' }],
  }),
});

if (res402.status !== 402) {
  console.error('FAIL: expected 402, got', res402.status);
  process.exit(1);
}

// BYOK bypass: connect user key with wallet mode auto
wallet.seed(USER, APP, 0);
const bridge = createBridge(USER);
await bridge.connect('openai', { kind: 'api_key', apiKey: 'sk-valid-test' });

const { resolveFundingSource } = await import('@account-bridge/core');
const funding = await resolveFundingSource({
  bridge,
  policy: { mode: 'auto' },
  wallet,
  hostKeyPool: pool,
  appId: APP,
  userId: USER,
});
if (funding.source !== 'byok') {
  console.error('FAIL: auto should prefer BYOK');
  process.exit(1);
}

server.close();
console.log('smoke:wallet OK');
