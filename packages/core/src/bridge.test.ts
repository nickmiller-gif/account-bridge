import { describe, expect, it, vi } from 'vitest';

import { createAccountBridge } from '../src/bridge.js';
import { createDefaultProviders } from '../src/registry.js';
import { InvalidCredentialError, NotConnectedError } from '../src/errors.js';
import { deriveKeyFromSecret } from '../src/crypto.js';
import { memoryStorage } from '../src/storage/memory.js';

const testKey = async () => ({ key: await deriveKeyFromSecret('bridge-test', 'ns') });

function mockFetch(ok: boolean, status = ok ? 200 : 401) {
  return vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
    if (String(url).includes('/v1/chat/completions') && init?.body && String(init.body).includes('"stream":true')) {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n'));
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
          controller.close();
        },
      });
      return { ok: true, status: 200, body: stream };
    }
    if (String(url).includes('/v1/models') || String(url).includes('/v1beta/models')) {
      return { ok, status, text: async () => '', json: async () => ({ data: [] }) };
    }
    if (String(url).includes('/v1/chat/completions')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          model: 'gpt-4o-mini',
          choices: [{ message: { content: 'Hello' } }],
          usage: { prompt_tokens: 1, completion_tokens: 1 },
        }),
      };
    }
    return { ok, status, text: async () => '' };
  });
}

describe('createAccountBridge', () => {
  it('connects after successful validation', async () => {
    const fetchMock = mockFetch(true);
    const bridge = createAccountBridge({
      storage: memoryStorage(),
      providers: createDefaultProviders(),
      getEncryptionKey: testKey,
      fetch: fetchMock,
    });

    const result = await bridge.connect('openai', { apiKey: 'sk-test-key' });
    expect(result.ok).toBe(true);
    expect(await bridge.has('openai')).toBe(true);
  });

  it('rejects invalid credentials', async () => {
    const bridge = createAccountBridge({
      storage: memoryStorage(),
      providers: createDefaultProviders(),
      getEncryptionKey: testKey,
      fetch: mockFetch(false, 401),
    });

    await expect(bridge.connect('openai', { apiKey: 'bad' })).rejects.toBeInstanceOf(
      InvalidCredentialError,
    );
  });

  it('emits subscribe events on connect and disconnect', async () => {
    const events: string[] = [];
    const bridge = createAccountBridge({
      storage: memoryStorage(),
      providers: createDefaultProviders(),
      getEncryptionKey: testKey,
      fetch: mockFetch(true),
    });
    bridge.subscribe((e) => events.push(`${e.type}:${e.providerId}`));

    await bridge.connect('openai', { apiKey: 'sk-test' });
    await bridge.disconnect('openai');

    expect(events).toEqual(['connect:openai', 'disconnect:openai']);
  });

  it('streams chat deltas', async () => {
    const bridge = createAccountBridge({
      storage: memoryStorage(),
      providers: createDefaultProviders(),
      getEncryptionKey: testKey,
      fetch: mockFetch(true),
    });
    await bridge.connect('openai', { apiKey: 'sk-test' });
    const client = await bridge.getClient('openai');
    expect(client.stream).toBeDefined();

    const chunks: string[] = [];
    for await (const chunk of client.stream!([{ role: 'user', content: 'Hi' }])) {
      chunks.push(chunk);
    }
    expect(chunks.join('')).toBe('Hi');
  });

  it('disconnect removes stored credentials', async () => {
    const bridge = createAccountBridge({
      storage: memoryStorage(),
      providers: createDefaultProviders(),
      getEncryptionKey: testKey,
      fetch: mockFetch(true),
    });
    await bridge.connect('anthropic', { apiKey: 'sk-ant-test' });
    await bridge.disconnect('anthropic');
    expect(await bridge.has('anthropic')).toBe(false);
  });

  it('getClient throws when not connected', async () => {
    const bridge = createAccountBridge({
      storage: memoryStorage(),
      providers: createDefaultProviders(),
      getEncryptionKey: testKey,
    });
    await expect(bridge.getClient('openai')).rejects.toBeInstanceOf(NotConnectedError);
  });

  it('listProviders shows connected and disconnected', async () => {
    const bridge = createAccountBridge({
      storage: memoryStorage(),
      providers: createDefaultProviders(),
      getEncryptionKey: testKey,
      fetch: mockFetch(true),
    });
    await bridge.connect('openai', { apiKey: 'sk-test' });
    const list = await bridge.listProviders();
    expect(list.find((p) => p.providerId === 'openai')?.connected).toBe(true);
    expect(list.find((p) => p.providerId === 'gemini')?.connected).toBe(false);
  });

  it('resolveClient uses default connected provider', async () => {
    const bridge = createAccountBridge({
      storage: memoryStorage(),
      providers: createDefaultProviders(),
      getEncryptionKey: testKey,
      fetch: mockFetch(true),
    });
    await bridge.connect('openai', { apiKey: 'sk-test' });
    await bridge.setDefaultProvider('openai');
    const { client, providerId } = await bridge.resolveClient();
    expect(providerId).toBe('openai');
    const result = await client.complete([{ role: 'user', content: 'Hi' }]);
    expect(result.content).toBe('Hello');
  });

  it('connects with oauth credential envelope', async () => {
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (String(url).includes('/v1beta/models')) {
        return { ok: true, status: 200, text: async () => '', json: async () => ({ models: [] }) };
      }
      return { ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: 'OAuth ok' }] } }] }) };
    });
    const bridge = createAccountBridge({
      storage: memoryStorage(),
      providers: createDefaultProviders(),
      getEncryptionKey: testKey,
      fetch: fetchMock,
    });
    await bridge.connect('gemini', {
      kind: 'oauth',
      accessToken: 'ya29.test-token',
    });
    expect(await bridge.has('gemini')).toBe(true);
  });
});
