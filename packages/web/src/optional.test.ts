/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';

import { isAccountBridgeEnabled, mountOptionalAccountBridge } from './optional.js';

describe('isAccountBridgeEnabled', () => {
  it('treats absent values as disabled', () => {
    expect(isAccountBridgeEnabled(undefined)).toBe(false);
    expect(isAccountBridgeEnabled(null)).toBe(false);
    expect(isAccountBridgeEnabled('')).toBe(false);
    expect(isAccountBridgeEnabled('   ')).toBe(false);
  });

  it('treats explicit falsy strings as disabled, case-insensitively', () => {
    for (const value of ['0', 'false', 'FALSE', 'no', 'off', 'Disabled']) {
      expect(isAccountBridgeEnabled(value)).toBe(false);
    }
  });

  it('treats booleans and numbers literally', () => {
    expect(isAccountBridgeEnabled(true)).toBe(true);
    expect(isAccountBridgeEnabled(false)).toBe(false);
    expect(isAccountBridgeEnabled(1)).toBe(true);
    expect(isAccountBridgeEnabled(0)).toBe(false);
  });

  it('treats any other non-empty value as enabled (set-the-env-var semantics)', () => {
    expect(isAccountBridgeEnabled('true')).toBe(true);
    expect(isAccountBridgeEnabled('1')).toBe(true);
    expect(isAccountBridgeEnabled('https://cdn.example.com/account-bridge.web.esm.js')).toBe(true);
  });
});

describe('mountOptionalAccountBridge', () => {
  it('is a strict no-op when disabled', () => {
    const target = document.createElement('div');
    const handle = mountOptionalAccountBridge({ target, register: false });

    expect(handle.mounted).toBe(false);
    expect(handle.element).toBeNull();
    expect(handle.reason).toBe('disabled');
    expect(target.childNodes.length).toBe(0);
    expect(() => handle.unmount()).not.toThrow();
  });

  it('reports a missing target without throwing', () => {
    const handle = mountOptionalAccountBridge({
      enabled: true,
      target: '#does-not-exist',
      register: false,
    });

    expect(handle.mounted).toBe(false);
    expect(handle.reason).toBe('target-not-found');
  });

  it('mounts the embed element with attributes when enabled', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    try {
      const handle = mountOptionalAccountBridge({
        enabled: 'true',
        target,
        register: false,
        attributes: {
          'app-id': 'demo-app',
          transport: 'local',
          mode: 'settings',
          theme: 'auto',
          compact: true,
          'base-url': undefined,
        },
      });

      expect(handle.mounted).toBe(true);
      expect(handle.element?.tagName.toLowerCase()).toBe('account-bridge-embed');
      expect(handle.element?.getAttribute('app-id')).toBe('demo-app');
      expect(handle.element?.getAttribute('mode')).toBe('settings');
      expect(handle.element?.hasAttribute('compact')).toBe(true);
      expect(handle.element?.hasAttribute('base-url')).toBe(false);
      expect(target.contains(handle.element)).toBe(true);

      handle.unmount();
      expect(target.childNodes.length).toBe(0);
    } finally {
      target.remove();
    }
  });

  it('skips invalid attribute names instead of throwing', () => {
    const target = document.createElement('div');
    document.body.appendChild(target);
    try {
      const handle = mountOptionalAccountBridge({
        enabled: true,
        target,
        register: false,
        attributes: {
          'app-id': 'demo-app',
          '"><img onerror=x>': 'nope',
          '': 'nope',
        },
      });

      expect(handle.mounted).toBe(true);
      expect(handle.element?.getAttribute('app-id')).toBe('demo-app');
      expect(handle.element?.attributes.length).toBe(1);
      handle.unmount();
    } finally {
      target.remove();
    }
  });

  it('resolves string targets via selector and supports other element tags', () => {
    const target = document.createElement('div');
    target.id = 'bridge-slot';
    document.body.appendChild(target);
    try {
      const handle = mountOptionalAccountBridge({
        enabled: true,
        target: '#bridge-slot',
        element: 'account-bridge-settings',
        register: false,
        attributes: { 'app-id': 'demo-app' },
      });

      expect(handle.mounted).toBe(true);
      expect(handle.element?.tagName.toLowerCase()).toBe('account-bridge-settings');
      handle.unmount();
    } finally {
      target.remove();
    }
  });
});
