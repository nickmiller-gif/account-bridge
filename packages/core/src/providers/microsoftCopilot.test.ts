import { describe, expect, it, vi } from 'vitest';

import { deriveKeyFromSecret } from '../crypto.js';
import { memoryStorage } from '../storage/memory.js';
import { createAccountBridge } from '../bridge.js';
import { createDefaultProviders } from '../registry.js';

const msProviders = () => createDefaultProviders({ includeMicrosoftCopilot: true });

const testKey = async () => ({ key: await deriveKeyFromSecret('ms-copilot-test', 'ns') });

function mockGraphFetch() {
  return vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
    const auth = init?.headers
      ? (init.headers as Record<string, string>).Authorization
      : undefined;
    if (!auth?.includes('valid-ms-token')) {
      return { ok: false, status: 401, text: async () => 'unauthorized' };
    }
    if (String(url).includes('/copilot/conversations') && init?.method === 'POST' && !String(url).includes('/chat')) {
      return {
        ok: true,
        status: 201,
        json: async () => ({ id: 'conv-test-123', turnCount: 0, messages: [] }),
      };
    }
    if (String(url).includes('/chat')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          id: 'conv-test-123',
          messages: [
            { id: 'u1', text: 'Analyze this deal' },
            { id: 'a1', text: 'Analysis: counter at 3% below market.' },
          ],
        }),
      };
    }
    return { ok: false, status: 404, text: async () => 'not found' };
  });
}

describe('microsoftCopilotProvider', () => {
  it('validates OAuth token against Graph Copilot API', async () => {
    const bridge = createAccountBridge({
      storage: memoryStorage(),
      providers: msProviders(),
      getEncryptionKey: testKey,
      fetch: mockGraphFetch(),
    });

    await bridge.connect('microsoft_copilot', {
      kind: 'oauth',
      accessToken: 'valid-ms-token',
    });
    expect(await bridge.has('microsoft_copilot')).toBe(true);
  });

  it('rejects invalid OAuth token', async () => {
    const bridge = createAccountBridge({
      storage: memoryStorage(),
      providers: msProviders(),
      getEncryptionKey: testKey,
      fetch: mockGraphFetch(),
    });

    await expect(
      bridge.connect('microsoft_copilot', { kind: 'oauth', accessToken: 'bad-token' }),
    ).rejects.toThrow();
  });

  it('completes chat via Graph Copilot conversation API', async () => {
    const bridge = createAccountBridge({
      storage: memoryStorage(),
      providers: msProviders(),
      getEncryptionKey: testKey,
      fetch: mockGraphFetch(),
    });

    await bridge.connect('microsoft_copilot', {
      kind: 'oauth',
      accessToken: 'valid-ms-token',
    });

    const { client } = await bridge.resolveClient('microsoft_copilot');
    const result = await client.complete([
      { role: 'system', content: 'You are a lease negotiation analyst.' },
      { role: 'user', content: 'Analyze this deal' },
    ]);

    expect(result.content).toContain('Analysis');
    expect(result.model).toBe('microsoft-copilot');
  });

  it('resetConversation clears Graph conversation id', async () => {
    const bridge = createAccountBridge({
      storage: memoryStorage(),
      providers: msProviders(),
      getEncryptionKey: testKey,
      fetch: mockGraphFetch(),
    });

    await bridge.connect('microsoft_copilot', {
      kind: 'oauth',
      accessToken: 'valid-ms-token',
    });

    const { client } = await bridge.resolveClient('microsoft_copilot');
    await client.complete([{ role: 'user', content: 'First turn' }]);
    client.resetConversation?.();
    const second = await client.complete([{ role: 'user', content: 'Second turn' }]);
    expect(second.content).toContain('Analysis');
  });
});
