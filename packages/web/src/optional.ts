import { registerAccountBridgeElements } from './elements.js';

/**
 * Raw feature-flag value — accepts booleans, numbers, and env-var strings
 * (`import.meta.env.VITE_…`, `process.env.…`) without pre-parsing.
 */
export type OptionalFlagValue = boolean | string | number | null | undefined;

const FALSY_FLAGS = new Set(['', '0', 'false', 'no', 'off', 'disabled']);

/**
 * Parse a host feature flag for Account Bridge.
 *
 * Opt-in semantics: absent (`null`/`undefined`) and explicit falsy strings
 * (`''`, `'0'`, `'false'`, `'no'`, `'off'`, `'disabled'`, case-insensitive)
 * are disabled. Any other non-empty value — `'true'`, `'1'`, or a config
 * value like an embed URL — enables the bridge, so "set the env var to turn
 * it on" works without a separate boolean flag.
 */
export function isAccountBridgeEnabled(value: OptionalFlagValue): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (value == null) return false;
  return !FALSY_FLAGS.has(value.trim().toLowerCase());
}

export type AccountBridgeElementTag =
  | 'account-bridge-embed'
  | 'account-bridge-settings'
  | 'account-bridge-copilot';

export interface MountOptionalAccountBridgeOptions {
  /**
   * Feature flag, parsed with {@link isAccountBridgeEnabled}.
   * Defaults to disabled — optional means opt-in.
   */
  enabled?: OptionalFlagValue;
  /** Element (or CSS selector) to mount the bridge element into. */
  target: Element | string;
  /** Which custom element to mount. Default `account-bridge-embed`. */
  element?: AccountBridgeElementTag;
  /**
   * Attributes for the element (`app-id`, `transport`, `mode`, `theme`, …).
   * `true` renders as an empty attribute; `false`/`undefined` are skipped.
   */
  attributes?: Record<string, string | number | boolean | undefined>;
  /**
   * Register the custom elements before mounting. Default `true`; set `false`
   * when the host has already called `registerAccountBridgeElements()` (or in
   * tests that only assert mount wiring).
   */
  register?: boolean;
  /** Override the document (tests, iframes). Defaults to `globalThis.document`. */
  document?: Document;
}

export interface OptionalAccountBridgeHandle {
  /** `true` when the element was created and appended. */
  mounted: boolean;
  /** The mounted element, or `null` when not mounted. */
  element: HTMLElement | null;
  /** Why the mount was skipped, when `mounted` is `false`. */
  reason?: 'disabled' | 'no-document' | 'target-not-found';
  /** Remove the element. Safe to call whether or not the mount happened. */
  unmount(): void;
}

const noopHandle = (reason: OptionalAccountBridgeHandle['reason']): OptionalAccountBridgeHandle => ({
  mounted: false,
  element: null,
  reason,
  unmount() {},
});

/**
 * Mount Account Bridge only when the host's feature flag is on.
 *
 * Disabled (the default) is a strict no-op — no custom elements registered,
 * no DOM touched, no storage opened — so hosts can call this unconditionally
 * and control the integration entirely from configuration.
 */
export function mountOptionalAccountBridge(
  options: MountOptionalAccountBridgeOptions,
): OptionalAccountBridgeHandle {
  if (!isAccountBridgeEnabled(options.enabled)) {
    return noopHandle('disabled');
  }

  const doc = options.document ?? globalThis.document;
  if (!doc) {
    return noopHandle('no-document');
  }

  const target =
    typeof options.target === 'string' ? doc.querySelector(options.target) : options.target;
  if (!target) {
    return noopHandle('target-not-found');
  }

  if (options.register !== false) {
    registerAccountBridgeElements();
  }

  const el = doc.createElement(options.element ?? 'account-bridge-embed');
  for (const [name, value] of Object.entries(options.attributes ?? {})) {
    if (value === undefined || value === false) continue;
    el.setAttribute(name, value === true ? '' : String(value));
  }
  target.appendChild(el);

  return {
    mounted: true,
    element: el,
    unmount() {
      el.remove();
    },
  };
}
