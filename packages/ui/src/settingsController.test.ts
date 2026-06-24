import { describe, expect, it, vi } from 'vitest';

import { createAccountBridge, createDefaultProviders } from '@account-bridge/core';
import { deriveKeyFromSecret } from '@account-bridge/core';
import { memoryStorage } from '@account-bridge/core';

import { createSettingsController } from './settingsController.js';
import { buildOAuthStartPath, startOAuthNavigation } from './oauth.js';
import { mergeClassNames, shadcnPreset } from './presets.js';

const testKey = async () => ({ key: await deriveKeyFromSecret('ui-test', 'ns') });

function mockFetch() {
  return vi.fn().mockImplementation(async (url: string) => {
    if (String(url).includes('/v1/models')) {
      return { ok: true, status: 200, text: async () => '', json: async () => ({ data: [] }) };
    }
    return { ok: true, status: 200, json: async () => ({}) };
  });
}

describe('SettingsController', () => {
  it('reflects connect state in cards', async () => {
    const bridge = createAccountBridge({
      storage: memoryStorage(),
      providers: createDefaultProviders(),
      getEncryptionKey: testKey,
      fetch: mockFetch(),
    });

    const controller = createSettingsController({ bridge });
    const states: string[] = [];
    controller.subscribe((s) => states.push(s.cards.find((c) => c.providerId === 'openai')?.connected ? 'yes' : 'no'));

    await new Promise((r) => setTimeout(r, 0));
    expect(states.at(-1)).toBe('no');

    await bridge.connect('openai', { apiKey: 'sk-test-key-12345' });
    await new Promise((r) => setTimeout(r, 0));

    expect(controller.getState().cards.find((c) => c.providerId === 'openai')?.connected).toBe(true);
    controller.destroy();
  });

  it('connectWithApiKey clears form on success', async () => {
    const bridge = createAccountBridge({
      storage: memoryStorage(),
      providers: createDefaultProviders(),
      getEncryptionKey: testKey,
      fetch: mockFetch(),
    });

    const controller = createSettingsController({ bridge });
    await new Promise((r) => setTimeout(r, 0));

    controller.setApiKey('openai', 'sk-test-key-12345');
    controller.toggleKeyForm('openai');
    await controller.connectWithApiKey('openai');

    const card = controller.getState().cards.find((c) => c.providerId === 'openai');
    expect(card?.connected).toBe(true);
    expect(card?.keyFormExpanded).toBe(false);
    expect(card?.apiKeyValue).toBe('');
    controller.destroy();
  });
});

describe('oauth helpers', () => {
  it('builds standard oauth path', () => {
    expect(buildOAuthStartPath('google')).toBe('/account-bridge/oauth/google/start');
  });

  it('calls onOAuthStart when provided', async () => {
    const handler = vi.fn();
    await startOAuthNavigation({
      providerId: 'gemini',
      oauthProviderKey: 'google',
      onOAuthStart: handler,
    });
    expect(handler).toHaveBeenCalledWith('gemini', 'google');
  });
});

describe('presets', () => {
  it('merges class name overrides', () => {
    const merged = mergeClassNames(shadcnPreset, { root: 'custom-root' });
    expect(merged.root).toBe('custom-root');
    expect(merged.button).toBe(shadcnPreset.button);
  });
});
