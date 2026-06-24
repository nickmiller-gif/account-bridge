import { describe, expect, it } from 'vitest';

import { createAccountBridge } from './bridge.js';
import { createHostKeyPool } from './hostKeyPool.js';
import { resolveFundingSource } from './fundingResolver.js';
import { createDefaultProviders } from './registry.js';
import { memoryStorage } from './storage/memory.js';
import { deriveKeyFromSecret } from './crypto.js';
import type { WalletStore } from './types.js';

function testBridge() {
  const mockFetch = async (url: string, init?: RequestInit) => {
    if (String(url).includes('/v1/models')) {
      return { ok: true, status: 200, json: async () => ({ data: [] }) };
    }
    return { ok: false, status: 404, text: async () => '' };
  };
  return createAccountBridge({
    storage: memoryStorage(),
    providers: createDefaultProviders(),
    getEncryptionKey: async () => ({
      key: await deriveKeyFromSecret('test-secret', 'test-app'),
    }),
    userId: 'user-1',
    appId: 'test-app',
    fetch: mockFetch as typeof fetch,
  });
}

function mockWallet(balance: number): WalletStore {
  return {
    async getBalance() {
      return { balanceMicrocredits: balance, currency: 'usd' };
    },
    async assertSufficientBalance(_userId, _appId, estimated) {
      if (balance < estimated) {
        const { ConsumerFundingRequiredError } = await import('./errors.js');
        throw new ConsumerFundingRequiredError('Insufficient app credits.');
      }
    },
    async debit() {
      return {
        id: '1',
        userId: 'user-1',
        appId: 'test-app',
        deltaMicrocredits: -100,
        reason: 'usage',
        createdAt: new Date().toISOString(),
      };
    },
    async credit() {
      return {
        id: '2',
        userId: 'user-1',
        appId: 'test-app',
        deltaMicrocredits: 100,
        reason: 'topup',
        createdAt: new Date().toISOString(),
      };
    },
    async listLedger() {
      return [];
    },
  };
}

describe('resolveFundingSource', () => {
  it('byok mode uses connected consumer credentials', async () => {
    const bridge = testBridge();
    await bridge.connect('openai', { kind: 'api_key', apiKey: 'sk-valid-test' });

    const resolved = await resolveFundingSource({
      bridge,
      policy: { mode: 'byok' },
      appId: 'test-app',
      userId: 'user-1',
    });

    expect(resolved.source).toBe('byok');
    expect(resolved.providerId).toBe('openai');
  });

  it('wallet mode uses host key pool', async () => {
    const bridge = testBridge();
    const pool = createHostKeyPool({
      providers: createDefaultProviders(),
      getEnvKey: (id) => (id === 'openai' ? 'sk-valid-test' : undefined),
    });

    const resolved = await resolveFundingSource({
      bridge,
      policy: { mode: 'wallet' },
      wallet: mockWallet(10_000),
      hostKeyPool: pool,
      appId: 'test-app',
      userId: 'user-1',
    });

    expect(resolved.source).toBe('wallet');
    expect(resolved.providerId).toBe('openai');
  });

  it('auto mode falls back to wallet when BYOK unavailable', async () => {
    const bridge = testBridge();
    const pool = createHostKeyPool({
      providers: createDefaultProviders(),
      getEnvKey: (id) => (id === 'openai' ? 'sk-valid-test' : undefined),
    });

    const resolved = await resolveFundingSource({
      bridge,
      policy: { mode: 'auto' },
      wallet: mockWallet(10_000),
      hostKeyPool: pool,
      appId: 'test-app',
      userId: 'user-1',
    });

    expect(resolved.source).toBe('wallet');
  });

  it('auto mode does not fall back to wallet on non-credit errors', async () => {
    const bridge = testBridge();
    await bridge.connect('openai', { kind: 'api_key', apiKey: 'sk-valid-test' });
    const pool = createHostKeyPool({
      providers: createDefaultProviders(),
      getEnvKey: (id) => (id === 'openai' ? 'sk-valid-test' : undefined),
    });

    const failingBridge = {
      ...bridge,
      async resolveClient() {
        throw new Error('upstream unavailable');
      },
    };

    await expect(
      resolveFundingSource({
        bridge: failingBridge,
        policy: { mode: 'auto' },
        wallet: mockWallet(10_000),
        hostKeyPool: pool,
        appId: 'test-app',
        userId: 'user-1',
      }),
    ).rejects.toThrow('upstream unavailable');
  });
});
