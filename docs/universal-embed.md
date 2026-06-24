# Universal embed — any host app

Account Bridge is a **plugin**, not a standalone site. One integration pattern works across CentralR2, R2Works, Lovable apps, Node backends, and local demos.

## Funding modes (v3)

| Mode | Consumer pays via |
|------|-------------------|
| `byok` | Own API key / OAuth (default) |
| `wallet` | Prepaid app credits on the host |
| `auto` | BYOK when connected, else wallet |

Set `fundingPolicy` on `mountAccountBridgeHost` / embed props. See [`wallet-billing.md`](./wallet-billing.md).

## 1. Pick an `appId` per product

Use a stable slug per host application. This isolates consumer credentials when apps share a database, filesystem, or browser origin.

| Host app | Suggested `appId` |
|----------|-------------------|
| CentralR2 | `centralr2-core` |
| R2Works | `r2works` |
| R2Chart / Continuity | `continuity-nexus` |
| R2-IP | `ip-pulse-point` |
| Custom Lovable app | your repo or Lovable project slug |

## 2. Browser — one component

Import theme CSS once:

```ts
import { accountBridgeThemeCss } from '@account-bridge/ui';
document.head.appendChild(Object.assign(document.createElement('style'), { textContent: accountBridgeThemeCss }));
```

Embed:

```tsx
import { AccountBridgeEmbed } from '@account-bridge/react';

<AccountBridgeEmbed
  appId="r2works"
  transport="remote"
  baseUrl="https://r2works.com"
  getAuthHeaders={() => ({ Authorization: `Bearer ${sessionJwt}` })}
  mode="gate"
  preset="shadcn"
>
  <MyAiFeature />
</AccountBridgeEmbed>
```

### Modes

| `mode` | Renders |
|--------|---------|
| `settings` | Provider connection cards only |
| `gate` | Settings fallback + `children` when connected |
| `copilot` | Inline copilot chat |
| `panel` | FAB copilot + optional `children` |
| `full` | Settings + copilot + FAB (demo layout) |

### Copilot provider lock

```tsx
<AccountBridgeEmbed
  appId="my-app"
  includeMicrosoftCopilot
  providerIds={['microsoft_copilot']}
  copilotProviderId="microsoft_copilot"
  mode="copilot"
  transport="remote"
  baseUrl="https://myapp.com"
  getAuthHeaders={...}
/>
```

Chat shows the active provider badge. With multiple connections, users pick **Reply via** in the header unless `copilotProviderId` is set.

### Theme

Pass `theme="light"`, `theme="dark"`, or `theme="auto"` on `AccountBridgeEmbed` (headless preset). Import `accountBridgeThemeCss` once globally.

### Compact settings

Use `compact` on embed or settings for tighter cards — ideal inside FAB panel gates:

```tsx
<AccountBridgeSettings compact theme="dark" />
```

### Optional providers

```tsx
<AccountBridgeEmbed
  appId="my-app"
  includeMicrosoftCopilot
  providerIds={['openai', 'anthropic', 'gemini', 'microsoft_copilot']}
  ...
/>
```

Microsoft Copilot is **opt-in** (requires Entra OAuth on the host). See [`providers/microsoft-copilot.md`](providers/microsoft-copilot.md).

### Local / demo transport

```tsx
<AccountBridgeEmbed appId="my-demo" transport="local" mode="full" />
```

Uses encrypted IndexedDB scoped by `appId` — no backend required.

## 2b. Web Components — no React

For static sites, legacy apps, or non-React stacks:

```html
<account-bridge-embed
  app-id="my-app"
  transport="local"
  mode="full"
  theme="dark"
  include-microsoft-copilot
  copilot-provider-id="microsoft_copilot"
></account-bridge-embed>
```

```ts
import { registerAccountBridgeElements } from '@account-bridge/web';
registerAccountBridgeElements();
```

Or load the IIFE bundle:

```html
<script src="https://unpkg.com/@account-bridge/web/bundle/dist/account-bridge.web.js" type="module"></script>
```

| Element | Purpose |
|---------|---------|
| `<account-bridge-settings>` | Provider connection cards |
| `<account-bridge-copilot>` | Inline chat |
| `<account-bridge-embed>` | Combined settings + copilot |

Production remote hosts: set `transport="remote"`, `base-url`, and listen for `auth-callback` on the element to supply session headers (or use `auth-token` for demos).

Example: [`examples/vanilla-demo`](../examples/vanilla-demo).

## 3. Server — one mount

```ts
import { mountAccountBridgeHost, memoryOAuthStateStore } from '@account-bridge/server';

mountAccountBridgeHost({
  app,
  config: {
    appId: 'r2works',
    baseUrl: 'https://r2works.com',
    getAuthHeaders: () => ({}), // browser-only field; omit on server if unused
    encryptionSecret: process.env.ACCOUNT_BRIDGE_ENCRYPTION_SECRET!,
  },
  resolveUser: (req) => sessionUserId(req.headers.authorization),
  stateStore: memoryOAuthStateStore(),
  google: { /* optional Gemini OAuth */ },
  microsoft: { /* optional M365 Copilot OAuth */ },
});
```

`createServerBridgeFactory({ appId, encryptionSecret, ... })` from `@account-bridge/core/node` is available for custom mounts.

## 4. Imperative AI from app code

```ts
import { ensureBridgeFundingReady } from '@account-bridge/ui';

const providerId = await ensureBridgeFundingReady(bridge);
const { client } = await bridge.resolveClient(providerId);
const result = await client.complete([{ role: 'user', content: prompt }]);
```

`ensureBridgeFundingReady` respects wallet + BYOK on remote hosts (`getFundingStatus`). For BYOK-only local bridges, use `assertConsumerCreditsReady` from `@account-bridge/core`.

## 5. Checklist per new app

- [ ] Unique `appId`
- [ ] Theme CSS imported (`accountBridgeThemeCss`) when using `preset="headless"`
- [ ] `transport="remote"` + host mount in production
- [ ] `ConsumerFundingGate` (or `mode="gate"` with `fundingPolicy`) on every consumer AI surface
- [ ] No host `OPENAI_API_KEY` on user-facing routes
- [ ] OAuth redirect URIs registered per `{apiPrefix}/oauth/{provider}/callback`

## Anti-pattern

Do **not** fork Account Bridge per app. Configure `appId`, `providerIds`, and branding props — the plugin stays one package.
