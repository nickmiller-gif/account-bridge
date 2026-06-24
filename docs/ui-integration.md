# UI integration — headless controller + presets

Account Bridge UI is split into **logic** (framework-agnostic) and **renderers** (React today; Web Components later).

## Architecture

```text
@account-bridge/ui          Headless SettingsController + CopilotController + shadcn presets
        ↓
@account-bridge/react       SettingsView, AccountBridgeSettings, AccountBridgeCopilot, ConsumerFundingGate
        ↓
Host app (R2Works, CentralR2, Lovable, …)
```

Universal backend contract remains **`mountAccountBridgeHostRoutes`** — any UI renderer calls the same REST API.

## Theme CSS (headless preset)

The **`headless`** preset ships a self-contained theme — no Tailwind required. Import once in your host app or demo:

```ts
import { accountBridgeThemeCss } from '@account-bridge/ui';

const style = document.createElement('style');
style.textContent = accountBridgeThemeCss;
document.head.appendChild(style);
```

Wrap components (automatic when using `AccountBridgeSettings` / `AccountBridgeCopilot` with `preset="headless"`):

```tsx
import { AccountBridgeTheme } from '@account-bridge/react';

<AccountBridgeTheme mode="dark">
  <AccountBridgeSettings />
</AccountBridgeTheme>
```

Use **`preset="shadcn"`** only when the host app already has Tailwind + shadcn tokens (`bg-card`, `text-muted-foreground`, etc.).

## React (recommended for R2 / Lovable)

### shadcn preset (default in ConsumerFundingGate)

```tsx
import { AccountBridgeProvider, ConsumerFundingGate } from '@account-bridge/react';
import { createBrowserHostBridge } from '@account-bridge/core';

const bridge = createBrowserHostBridge({
  appId: 'my-app',
  baseUrl: 'https://myapp.com',
  getAuthHeaders: () => ({ Authorization: `Bearer ${sessionJwt}` }),
});

<AccountBridgeProvider bridge={bridge}>
  <ConsumerFundingGate
    fundingPolicy={{ mode: 'auto', wallet: { enabled: true } }}
    baseUrl="https://myapp.com"
    getAuthHeaders={() => ({ Authorization: `Bearer ${sessionJwt}` })}
  >
    <MyAiFeature />
  </ConsumerFundingGate>
</AccountBridgeProvider>
```

`ConsumerFundingGate` embeds **My accounts** / **App credits** tabs when wallet is enabled; otherwise it shows `AccountBridgeSettings preset="shadcn"` automatically.

### Settings page with shadcn styling

```tsx
<AccountBridgeSettings
  preset="shadcn"
  getOAuthStartUrl={(key) => `/account-bridge/oauth/${key}/start`}
/>
```

### Custom design system overrides

```tsx
import { AccountBridgeSettings, shadcnPreset, mergeClassNames } from '@account-bridge/react';

<AccountBridgeSettings
  preset="shadcn"
  classNames={mergeClassNames(shadcnPreset, {
    card: 'rounded-xl border-2 border-brand/20 p-6',
    button: 'rounded-full bg-brand text-white',
  })}
/>
```

## Headless (Vue, Svelte, vanilla, mobile)

Use `@account-bridge/ui` directly with `createBrowserHostBridge` from core:

```ts
import { createSettingsController, headlessPreset, headlessCssVariables } from '@account-bridge/ui';
import { createBrowserHostBridge } from '@account-bridge/core';

const bridge = createBrowserHostBridge({ appId: 'my-app', baseUrl, getAuthHeaders });
const controller = createSettingsController({
  bridge,
  getOAuthStartUrl: (key) => `/account-bridge/oauth/${key}/start`,
});

controller.subscribe((state) => {
  renderYourFramework(state, controller);
});
```

Import `headlessCssVariables` into global CSS for the `ab-settings__*` classes, or map `headlessPreset` class names to your tokens.

## Copilot chat

Drop-in multi-turn chat UI powered by the consumer's connected provider.

### Inline copilot (settings gate + chat)

```tsx
import {
  AccountBridgeProvider,
  ConsumerFundingGate,
  AccountBridgeCopilot,
} from '@account-bridge/react';

<AccountBridgeProvider bridge={bridge}>
  <ConsumerFundingGate
    baseUrl="https://myapp.com"
    getAuthHeaders={() => ({ Authorization: `Bearer ${sessionJwt}` })}
    fundingPolicy={{ mode: 'auto', wallet: { enabled: true } }}
  >
    <AccountBridgeCopilot preset="shadcn" stream systemPrompt="You are a helpful assistant." />
  </ConsumerFundingGate>
</AccountBridgeProvider>
```

### Floating panel (Eigen-style FAB)

```tsx
import { AccountBridgeCopilotPanel } from '@account-bridge/react';

<AccountBridgeCopilotPanel preset="shadcn" panelTitle="Copilot" gateWithSettings />
```

`gateWithSettings` embeds the shadcn settings UI inside the panel when the consumer has not connected a provider yet.

### Headless copilot (Vue, Svelte, vanilla)

```ts
import { createCopilotController, headlessCopilotPreset } from '@account-bridge/ui';

const controller = createCopilotController({
  bridge,
  stream: true,
  systemPrompt: 'You are a helpful assistant.',
});

controller.subscribe((state) => renderMessages(state));
controller.setInput('Hello');
await controller.send();
```

Import `accountBridgeThemeCss` for `.ab-copilot__*` styling, or use `shadcnCopilotPreset` class maps with Tailwind.

### Host REST — multi-turn `/account-bridge/copilot/chat`

For non-browser clients, POST an array of `{ role, content }` messages (optional `systemPrompt`, `stream`):

```json
{
  "messages": [
    { "role": "user", "content": "Summarize this in one sentence." }
  ],
  "stream": true
}
```

Single-turn shorthand remains **`POST /account-bridge/chat`** with `{ "message": "…" }`.

## Controller API (settings)

| Method | Purpose |
|--------|---------|
| `subscribe(fn)` | React to state changes |
| `connectWithApiKey(id)` | Validate + store consumer key |
| `disconnect(id)` | Remove credentials |
| `testConnection(id)` | Live validation |
| `setDefaultProvider(id)` | Routing default for gateway |
| `startOAuth(id, key)` | Redirect to host OAuth route |
| `isConsumerReady()` | Gate AI features |

## Copilot controller API

| Method | Purpose |
|--------|---------|
| `subscribe(fn)` | React to message list / input / busy state |
| `setInput(text)` | Update composer |
| `send()` | Append user turn, stream or complete assistant reply |
| `clear()` | Reset conversation |
| `regenerateLast()` | Re-run last user message |

## Presets export

```ts
import {
  shadcnPreset,
  headlessPreset,
  mergeClassNames,
  shadcnCopilotPreset,
  headlessCopilotPreset,
  mergeCopilotClassNames,
} from '@account-bridge/ui/presets';
```

## Next: Web Components (`@account-bridge/web`)

The headless controller is the stable core for a future `<account-bridge-settings>` custom element — same controller, different renderer.
