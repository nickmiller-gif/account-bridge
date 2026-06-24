import { describe, expect, it, vi } from 'vitest';

import { createAccountBridge, createDefaultProviders } from '@account-bridge/core';
import { deriveKeyFromSecret } from '@account-bridge/core';
import { memoryStorage } from '@account-bridge/core';

import { createCopilotController } from './copilotController.js';

const testKey = async () => ({ key: await deriveKeyFromSecret('copilot-test', 'ns') });

function mockFetch() {
  return vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
    if (String(url).includes('/v1/models')) {
      return { ok: true, status: 200, json: async () => ({ data: [] }) };
    }
    if (String(url).includes('/v1/chat/completions') && init?.body && String(init.body).includes('"stream":true')) {
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n'));
          controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'));
          controller.close();
        },
      });
      return { ok: true, status: 200, body: stream };
    }
    if (String(url).includes('/v1/chat/completions')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          model: 'gpt-4o-mini',
          choices: [{ message: { content: 'Hi there' } }],
        }),
      };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  });
}

describe('CopilotController', () => {
  it('sends a message and streams assistant reply', async () => {
    const bridge = createAccountBridge({
      storage: memoryStorage(),
      providers: createDefaultProviders(),
      getEncryptionKey: testKey,
      fetch: mockFetch(),
    });
    await bridge.connect('openai', { apiKey: 'sk-test-key-12345' });

    const controller = createCopilotController({ bridge, stream: true });
    controller.setInput('Hello copilot');
    await controller.send();

    const state = controller.getState();
    expect(state.messages).toHaveLength(2);
    expect(state.messages[0]?.role).toBe('user');
    expect(state.messages[1]?.role).toBe('assistant');
    expect(state.messages[1]?.content).toBe('Hello');
    expect(state.messages[1]?.providerId).toBe('openai');
    controller.destroy();
  });

  it('clears conversation', async () => {
    const bridge = createAccountBridge({
      storage: memoryStorage(),
      providers: createDefaultProviders(),
      getEncryptionKey: testKey,
      fetch: mockFetch(),
    });
    await bridge.connect('openai', { apiKey: 'sk-test-key-12345' });

    const controller = createCopilotController({ bridge });
    controller.setInput('Test');
    await controller.send();
    controller.clear();
    expect(controller.getState().messages).toHaveLength(0);
    controller.destroy();
  });

  it('calls resetConversation on clear when client supports it', async () => {
    const resetConversation = vi.fn();
    const bridge = createAccountBridge({
      storage: memoryStorage(),
      providers: createDefaultProviders(),
      getEncryptionKey: testKey,
      fetch: mockFetch(),
    });
    await bridge.connect('openai', { apiKey: 'sk-test-key-12345' });

    const originalGetClient = bridge.getClient.bind(bridge);
    bridge.getClient = async (providerId) => {
      const client = await originalGetClient(providerId);
      return { ...client, resetConversation };
    };

    const controller = createCopilotController({ bridge });
    controller.setInput('Test');
    await controller.send();
    controller.clear();
    expect(resetConversation).toHaveBeenCalledOnce();
    controller.destroy();
  });

  it('shows active provider label before first message when one provider connected', async () => {
    const bridge = createAccountBridge({
      storage: memoryStorage(),
      providers: createDefaultProviders(),
      getEncryptionKey: testKey,
      fetch: mockFetch(),
    });
    await bridge.connect('openai', { apiKey: 'sk-test-key-12345' });

    const controller = createCopilotController({ bridge });
    await controller.refreshConnectedProviders();
    const state = controller.getState();
    expect(state.activeProviderLabel).toBeTruthy();
    expect(state.connectedProviders).toHaveLength(1);
    controller.destroy();
  });

  it('dismissError clears error state', async () => {
    const baseFetch = mockFetch();
    const fetchImpl = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (String(url).includes('/v1/chat/completions')) {
        throw new Error('network failed');
      }
      return baseFetch(url, init);
    });

    const bridge = createAccountBridge({
      storage: memoryStorage(),
      providers: createDefaultProviders(),
      getEncryptionKey: testKey,
      fetch: fetchImpl,
    });
    await bridge.connect('openai', { apiKey: 'sk-test-key-12345' });

    const controller = createCopilotController({ bridge, stream: false });
    controller.setInput('Hi');
    await controller.send();
    expect(controller.getState().error).toBeTruthy();
    controller.dismissError();
    expect(controller.getState().error).toBeNull();
    controller.destroy();
  });
});
