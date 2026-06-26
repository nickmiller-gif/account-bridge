/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';

import { configFromElement } from './bootstrap.js';

describe('configFromElement', () => {
  it('reads app-id and transport attributes', () => {
    const el = document.createElement('account-bridge-embed');
    el.setAttribute('app-id', 'demo-app');
    el.setAttribute('transport', 'remote');
    el.setAttribute('base-url', 'https://example.com');
    el.setAttribute('include-microsoft-copilot', 'true');

    const config = configFromElement(el);
    expect(config.appId).toBe('demo-app');
    expect(config.transport).toBe('remote');
    expect(config.baseUrl).toBe('https://example.com');
    expect(config.includeMicrosoftCopilot).toBe(true);
  });

  it('defaults to local transport and dark theme', () => {
    const el = document.createElement('div');
    const config = configFromElement(el);
    expect(config.transport).toBe('local');
    expect(config.theme).toBe('dark');
    expect(config.mode).toBeUndefined();
  });

  it('reads publishable-key and funding-mode attributes', () => {
    const el = document.createElement('account-bridge-embed');
    el.setAttribute('publishable-key', 'ab_pk_test');
    el.setAttribute('funding-mode', 'auto');
    el.setAttribute('wallet-enabled', 'true');

    const config = configFromElement(el);
    expect(config.publishableKey).toBe('ab_pk_test');
    expect(config.fundingPolicy).toEqual({ mode: 'auto', wallet: { enabled: true } });
  });
});
