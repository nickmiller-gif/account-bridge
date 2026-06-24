import { describe, expect, it, vi } from 'vitest';

import { createAccountBridge, createDefaultProviders } from '@account-bridge/core';
import { deriveKeyFromSecret } from '@account-bridge/core';
import { memoryStorage } from '@account-bridge/core';
import { createAccountBridgeGatewayHandlers } from '@account-bridge/gateway';

const testKey = async () => ({ key: await deriveKeyFromSecret('gw-test', 'ns') });

function mockFetch() {
  return vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
    if (String(url).includes('/v1/chat/completions') && init?.body && String(init.body).includes('"stream":true')) {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n'));
          controller.close();
        },
      });
      return { ok: true, status: 200, body: stream };
    }
    if (String(url).includes('/v1/models')) {
      return { ok: true, status: 200, json: async () => ({ data: [] }) };
    }
    if (String(url).includes('/v1/chat/completions')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          model: 'gpt-4o-mini',
          choices: [{ message: { content: 'Gateway hello' } }],
        }),
      };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  });
}

describe('createAccountBridgeGatewayHandlers', () => {
  it('returns health', async () => {
    const { handle } = createAccountBridgeGatewayHandlers({
      resolveUser: () => 'user-1',
      createBridge: () =>
        createAccountBridge({
          storage: memoryStorage(),
          providers: createDefaultProviders(),
          getEncryptionKey: testKey,
        }),
    });

    const res = {
      statusCode: 0,
      headers: {} as Record<string, string>,
      body: '',
      setHeader(k: string, v: string) {
        this.headers[k] = v;
      },
      end(payload?: string) {
        this.body = payload ?? '';
      },
    };

    await handle({ method: 'GET', url: '/health', headers: {} }, res as never);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).ok).toBe(true);
  });

  it('proxies chat completions for authed user', async () => {
    const bridge = createAccountBridge({
      storage: memoryStorage(),
      providers: createDefaultProviders(),
      getEncryptionKey: testKey,
      fetch: mockFetch(),
      userId: 'user-1',
    });
    await bridge.connect('openai', { apiKey: 'sk-test' });
    await bridge.setDefaultProvider('openai');

    const { handle } = createAccountBridgeGatewayHandlers({
      resolveUser: () => 'user-1',
      createBridge: () => bridge,
    });

    const res = {
      statusCode: 0,
      headers: {} as Record<string, string>,
      body: '',
      setHeader(k: string, v: string) {
        this.headers[k] = v;
      },
      end(payload?: string) {
        this.body = payload ?? '';
      },
    };

    await handle(
      {
        method: 'POST',
        url: '/v1/chat/completions',
        headers: { authorization: 'Bearer demo' },
        body: {
          messages: [{ role: 'user', content: 'Hello' }],
        },
      },
      res as never,
    );

    expect(res.statusCode).toBe(200);
    const parsed = JSON.parse(res.body);
    expect(parsed.choices[0].message.content).toBe('Gateway hello');
  });

  it('rejects provider api keys on gateway Authorization header', async () => {
    const { handle } = createAccountBridgeGatewayHandlers({
      resolveUser: () => 'user-1',
      createBridge: () =>
        createAccountBridge({
          storage: memoryStorage(),
          providers: createDefaultProviders(),
          getEncryptionKey: testKey,
        }),
    });

    const res = {
      statusCode: 0,
      headers: {} as Record<string, string>,
      body: '',
      setHeader(k: string, v: string) {
        this.headers[k] = v;
      },
      end(payload?: string) {
        this.body = payload ?? '';
      },
    };

    await handle(
      {
        method: 'POST',
        url: '/v1/chat/completions',
        headers: { authorization: 'Bearer sk-proj-test123456789012345678' },
        body: { messages: [{ role: 'user', content: 'Hello' }] },
      },
      res as never,
    );

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.body).error.message).toContain('Provider API keys');
  });

  it('returns 402 when wallet balance is insufficient', async () => {
    const pool = {
      has: (id: string) => id === 'openai',
      resolveClient: async () => ({
        providerId: 'openai' as const,
        client: {
          async complete() {
            return { content: 'ok', model: 'gpt-4o-mini' };
          },
        },
      }),
    };

    const wallet = {
      async getBalance() {
        return { balanceMicrocredits: 0, currency: 'usd' };
      },
      async assertSufficientBalance() {
        const { ConsumerFundingRequiredError } = await import('@account-bridge/core');
        throw new ConsumerFundingRequiredError('Insufficient app credits.');
      },
      async debit() {
        throw new Error('should not debit');
      },
      async credit() {
        throw new Error('not used');
      },
      async listLedger() {
        return [];
      },
    };

    const bridge = createAccountBridge({
      storage: memoryStorage(),
      providers: createDefaultProviders(),
      getEncryptionKey: testKey,
    });

    const { handle } = createAccountBridgeGatewayHandlers({
      resolveUser: () => 'user-1',
      createBridge: () => bridge,
      appId: 'test-app',
      fundingPolicy: { mode: 'wallet', wallet: { enabled: true } },
      wallet,
      hostKeyPool: pool as never,
    });

    const res = {
      statusCode: 0,
      headers: {} as Record<string, string>,
      body: '',
      setHeader(k: string, v: string) {
        this.headers[k] = v;
      },
      end(payload?: string) {
        this.body = payload ?? '';
      },
    };

    await handle(
      {
        method: 'POST',
        url: '/v1/chat/completions',
        headers: { authorization: 'Bearer demo-session' },
        body: { messages: [{ role: 'user', content: 'Hello' }] },
      },
      res as never,
    );

    expect(res.statusCode).toBe(402);
    expect(JSON.parse(res.body).error.code).toBe('insufficient_credits');
  });

  it('debits wallet on successful wallet-funded chat', async () => {
    let debited = false;
    const pool = {
      has: (id: string) => id === 'openai',
      resolveClient: async () => ({
        providerId: 'openai' as const,
        client: {
          async complete() {
            return { content: 'wallet ok', model: 'gpt-4o-mini', usage: { inputTokens: 10, outputTokens: 5 } };
          },
        },
      }),
    };

    const wallet = {
      async getBalance() {
        return { balanceMicrocredits: 50_000, currency: 'usd' };
      },
      async assertSufficientBalance() {},
      async debit() {
        debited = true;
        return {
          id: 'led-1',
          userId: 'user-1',
          appId: 'test-app',
          deltaMicrocredits: -100,
          reason: 'usage',
          createdAt: new Date().toISOString(),
        };
      },
      async credit() {
        throw new Error('not used');
      },
      async listLedger() {
        return [];
      },
    };

    const bridge = createAccountBridge({
      storage: memoryStorage(),
      providers: createDefaultProviders(),
      getEncryptionKey: testKey,
    });

    const { handle } = createAccountBridgeGatewayHandlers({
      resolveUser: () => 'user-1',
      createBridge: () => bridge,
      appId: 'test-app',
      fundingPolicy: { mode: 'wallet', wallet: { enabled: true } },
      wallet,
      hostKeyPool: pool as never,
      enforceConsumerCredits: false,
    });

    const res = {
      statusCode: 0,
      headers: {} as Record<string, string>,
      body: '',
      setHeader(k: string, v: string) {
        this.headers[k] = v;
      },
      end(payload?: string) {
        this.body = payload ?? '';
      },
    };

    await handle(
      {
        method: 'POST',
        url: '/v1/chat/completions',
        headers: { authorization: 'Bearer demo-session' },
        body: { messages: [{ role: 'user', content: 'Hello' }] },
      },
      res as never,
    );

    expect(res.statusCode).toBe(200);
    expect(debited).toBe(true);
    expect(res.headers['x-account-bridge-funding']).toBe('wallet');
  });

  it('returns 402 on streaming wallet chat before SSE when before_stream debit fails', async () => {
    const pool = {
      has: (id: string) => id === 'openai',
      resolveClient: async () => ({
        providerId: 'openai' as const,
        client: {
          async *stream() {
            yield 'should not stream';
          },
        },
      }),
    };

    const wallet = {
      async getBalance() {
        return { balanceMicrocredits: 50_000, currency: 'usd' };
      },
      async assertSufficientBalance() {},
      async debit() {
        const { ConsumerFundingRequiredError } = await import('@account-bridge/core');
        throw new ConsumerFundingRequiredError('Insufficient app credits.');
      },
      async credit() {
        throw new Error('not used');
      },
      async listLedger() {
        return [];
      },
    };

    const bridge = createAccountBridge({
      storage: memoryStorage(),
      providers: createDefaultProviders(),
      getEncryptionKey: testKey,
    });

    const { handle } = createAccountBridgeGatewayHandlers({
      resolveUser: () => 'user-1',
      createBridge: () => bridge,
      appId: 'test-app',
      fundingPolicy: { mode: 'wallet', wallet: { enabled: true } },
      wallet,
      hostKeyPool: pool as never,
      walletStreamDebit: 'before_stream',
      enforceConsumerCredits: false,
    });

    let wrote = false;
    const res = {
      statusCode: 0,
      headers: {} as Record<string, string>,
      body: '',
      setHeader(k: string, v: string) {
        this.headers[k] = v;
      },
      write() {
        wrote = true;
      },
      flushHeaders() {},
      end(payload?: string) {
        this.body = payload ?? '';
      },
    };

    await handle(
      {
        method: 'POST',
        url: '/v1/chat/completions',
        headers: { authorization: 'Bearer demo-session' },
        body: { stream: true, messages: [{ role: 'user', content: 'Hello' }] },
      },
      res as never,
    );

    expect(res.statusCode).toBe(402);
    expect(JSON.parse(res.body).error.code).toBe('insufficient_credits');
    expect(wrote).toBe(false);
  });
});
