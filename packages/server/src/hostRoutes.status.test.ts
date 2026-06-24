import { describe, expect, it } from 'vitest';

import type { AccountBridge, ProviderId } from '@account-bridge/core';
import { memoryWalletStore } from '@account-bridge/billing';
import express from 'express';
import { createServer } from 'node:http';

import { mountAccountBridgeHostRoutes } from '../src/hostRoutes.js';

function mockBridge(connected: ProviderId | null = null): AccountBridge {
  return {
    async connect() {
      return { ok: true, message: 'ok' };
    },
    async disconnect() {},
    async has(id) {
      return id === connected;
    },
    async getClient() {
      throw new Error('not used');
    },
    async resolveClient() {
      throw new Error('not used');
    },
    async validate() {
      return { ok: true };
    },
    async listProviders() {
      return connected
        ? [{ providerId: connected, connected: true }]
        : [{ providerId: 'openai', connected: false }];
    },
    getProviderDefinition(id) {
      return { id, displayName: id, authKind: 'api_key' as const };
    },
    async getDefaultProvider() {
      return connected;
    },
    async setDefaultProvider() {},
    subscribe() {
      return () => {};
    },
  };
}

async function fetchStatus(port: number, auth?: string) {
  const res = await fetch(`http://127.0.0.1:${port}/account-bridge/status`, {
    headers: auth ? { Authorization: auth } : {},
  });
  return { status: res.status, body: await res.json() };
}

describe('GET /account-bridge/status', () => {
  it('returns 401 without session', async () => {
    const app = express();
    const wallet = memoryWalletStore();
    mountAccountBridgeHostRoutes({
      app,
      enforceConsumerCredits: false,
      resolveUser: (req) =>
        String(req.headers.authorization ?? '') === 'Bearer ok' ? 'user-1' : null,
      createBridge: () => mockBridge(),
      wallet,
      appId: 'status-test',
      fundingPolicy: { mode: 'auto', wallet: { enabled: true } },
    });

    const server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as { port: number }).port;

    const { status } = await fetchStatus(port);
    server.close();
    expect(status).toBe(401);
  });

  it('returns ready false for auto mode with no BYOK and empty wallet', async () => {
    const app = express();
    const wallet = memoryWalletStore();
    mountAccountBridgeHostRoutes({
      app,
      enforceConsumerCredits: false,
      resolveUser: () => 'user-1',
      createBridge: () => mockBridge(),
      wallet,
      appId: 'status-test',
      fundingPolicy: { mode: 'auto', wallet: { enabled: true } },
    });

    const server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as { port: number }).port;

    const { status, body } = await fetchStatus(port, 'Bearer ok');
    server.close();
    expect(status).toBe(200);
    expect(body.ready).toBe(false);
    expect(body.walletEnabled).toBe(true);
  });

  it('returns ready true for wallet mode with seeded balance', async () => {
    const app = express();
    const wallet = memoryWalletStore();
    wallet.seed('user-1', 'status-test', 50_000);
    mountAccountBridgeHostRoutes({
      app,
      enforceConsumerCredits: false,
      resolveUser: () => 'user-1',
      createBridge: () => mockBridge(),
      wallet,
      appId: 'status-test',
      fundingPolicy: { mode: 'wallet', wallet: { enabled: true } },
    });

    const server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as { port: number }).port;

    const { body } = await fetchStatus(port, 'Bearer ok');
    server.close();
    expect(body.ready).toBe(true);
    expect(body.walletBalanceMicrocredits).toBe(50_000);
  });

  it('returns ready true for byok mode when provider connected', async () => {
    const app = express();
    mountAccountBridgeHostRoutes({
      app,
      enforceConsumerCredits: false,
      resolveUser: () => 'user-1',
      createBridge: () => mockBridge('openai'),
      appId: 'status-test',
      fundingPolicy: { mode: 'byok' },
    });

    const server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as { port: number }).port;

    const { body } = await fetchStatus(port, 'Bearer ok');
    server.close();
    expect(body.ready).toBe(true);
    expect(body.connectedCount).toBe(1);
  });
});
