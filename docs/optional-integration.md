# Optional integration — ship Account Bridge dark

Account Bridge is designed to be **opt-in per deployment**: a host app wires it once, keeps it
off by default, and turns it on with configuration — no rebuild, no behavior change while it's
off. This guide covers the three integration paths.

## Semantics

- **Off is the default.** Absent flags, empty strings, and `'0' | 'false' | 'no' | 'off' | 'disabled'`
  all mean disabled (`isAccountBridgeEnabled`).
- **Off is a strict no-op.** No custom elements registered, no DOM rendered, no IndexedDB opened,
  no network calls — gated features render exactly as if Account Bridge were never installed.
- **On is one config value.** A single env var (commonly the embed bundle URL itself) flips it.

## 1. React hosts (package dependency)

`AccountBridgeEmbed` accepts an `enabled` prop. When `false`, it renders `children` untouched:

```tsx
import { AccountBridgeEmbed } from '@account-bridge/react';

const bridgeEnabled = isAccountBridgeEnabled(import.meta.env.VITE_ACCOUNT_BRIDGE_ENABLED);

<AccountBridgeEmbed appId="my-app" transport="local" mode="gate" enabled={bridgeEnabled}>
  <MyAiFeature />  {/* renders directly when disabled — never gated */}
</AccountBridgeEmbed>
```

No bridge is constructed and no storage is touched when `enabled` is `false`, so the component
is safe to leave mounted unconditionally.

## 2. Script hosts (package dependency, imperative)

`mountOptionalAccountBridge` from `@account-bridge/web` no-ops unless the flag parses truthy:

```ts
import { mountOptionalAccountBridge } from '@account-bridge/web';

const handle = mountOptionalAccountBridge({
  enabled: import.meta.env.VITE_ACCOUNT_BRIDGE_ENABLED, // raw env string is fine
  target: '#ai-accounts',
  attributes: { 'app-id': 'my-app', transport: 'local', mode: 'settings', theme: 'auto' },
});
// handle.mounted === false when disabled; handle.unmount() to remove
```

## 3. Runtime-loaded hosts (no build-time dependency)

For hosts that cannot (or should not) add `@account-bridge/*` to their dependency tree —
separate repos, separate CI, Lovable-managed builds — load the self-contained web-components
bundle at runtime, gated on an optional env var. The bundle registers
`<account-bridge-embed>` / `<account-bridge-settings>` / `<account-bridge-copilot>` on import
and inlines all dependencies.

**Build and host the bundle** (once, from this repo):

```bash
npm run build -w @account-bridge/web
# dist/account-bridge.web.esm.js  (ES module — use with <script type="module">)
# dist/account-bridge.web.js     (IIFE — window.AccountBridge)
```

Copy `packages/web/dist/account-bridge.web.esm.js` anywhere the host can reach it: the host's
own `public/` directory (e.g. `/vendor/account-bridge.web.esm.js`), Supabase Storage, or any CDN.

**Host-side loader** (vendored — small enough to copy per host):

```ts
// accountBridge.ts — the host's only Account Bridge code
const EMBED_URL = import.meta.env.VITE_ACCOUNT_BRIDGE_EMBED_URL as string | undefined;

export function isAccountBridgeEnabled(): boolean {
  return Boolean(EMBED_URL?.trim());
}

let loadPromise: Promise<void> | null = null;

export function loadAccountBridgeEmbed(): Promise<void> {
  if (!isAccountBridgeEnabled()) return Promise.reject(new Error('Account Bridge is not enabled'));
  loadPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.type = 'module';
    script.src = EMBED_URL!;
    script.onload = () => resolve();
    script.onerror = () => {
      loadPromise = null;
      script.remove();
      reject(new Error('Failed to load the Account Bridge embed bundle'));
    };
    document.head.appendChild(script);
  });
  return loadPromise;
}
```

Then render the element only when enabled and loaded:

```tsx
await loadAccountBridgeEmbed();
// <account-bridge-embed app-id="my-app" transport="local" mode="settings" theme="dark" />
```

With the env var unset, the host bundle is unchanged and no Account Bridge code is ever fetched.

### R2 ecosystem convention

R2 host apps (e.g. `centralr2-core`) use path 3 with:

- `VITE_ACCOUNT_BRIDGE_EMBED_URL` — presence enables the feature (optional env, never required
  at startup)
- `appId` set to the repo slug (`centralr2-core`, `r2works`, …) so credentials stay isolated
  per product
- `transport="local"` to start (encrypted IndexedDB, no backend), upgradeable to
  `transport="remote"` + a host mount later without changing the flag wiring

## Choosing a path

| Host situation | Path |
|---|---|
| React app that depends on `@account-bridge/react` | 1 — `enabled` prop |
| Non-React app that depends on `@account-bridge/web` | 2 — `mountOptionalAccountBridge` |
| App in a separate repo/CI with no dependency on this repo | 3 — runtime bundle + env var |
