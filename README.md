# Account Bridge

Generic **bring-your-own-key (BYOK)** + **app credits wallet** plugin for any app. End users fund AI usage—the host developer does not pay for model calls.

## What's new in v3.4

- **Optional integration** — ship dark, flip on with config: `enabled` prop on `AccountBridgeEmbed` (renders children untouched when off), `mountOptionalAccountBridge` + `isAccountBridgeEnabled` in `@account-bridge/web`
- **Runtime-loaded hosts** — flag-gated `<script type="module">` recipe for apps with no build-time dependency on this repo (R2 ecosystem convention: `VITE_ACCOUNT_BRIDGE_EMBED_URL`)

See [`docs/optional-integration.md`](docs/optional-integration.md) and [`CHANGELOG.md`](CHANGELOG.md#340--2026-07-01).

## What's new in v3.3

- **Production guardrails** — `demoMode: false` requires real `resolveConsumerUser`; signup rate limits; sanitized errors
- **Quota fixes** — account-wide live enforcement; usage only on successful responses; `past_due` blocked
- **Validation** — email/slug/funding policy; reserved slugs; atomic file store writes

See [`CHANGELOG.md`](CHANGELOG.md#330--2026-06-24).

## What's new in v3.2

- **App lifecycle API** — `PATCH /apps/:slug`, rotate secret, usage metrics on `/me`
- **Live tenant funding** — policy updates apply without restart (`resolveFundingPolicy`)
- **Host dashboard** — usage bars, funding selector, copy embed, demo tenant banner

See [`CHANGELOG.md`](CHANGELOG.md#320--2026-06-24).

## What's new in v3.1

- **Platform SaaS** — `@account-bridge/platform` + `mountPlatformService` for multi-tenant hosted API
- **Host console demo** — `npm run demo:platform` (API + dashboard + walkthrough scenario 5)
- **Publishable keys** — `publishableKey` on `AccountBridgeEmbed` / `createBrowserHostBridge`
- **Stripe subscriptions** — Free / Pro / Business plans for host billing

See [`docs/platform-saas.md`](docs/platform-saas.md).

## What's new in v3.0

- **Funding modes** — `byok`, `wallet`, or `auto` (BYOK if connected, else prepaid credits)
- **`@account-bridge/billing`** — wallet ledger, usage debit, optional Stripe top-up
- **`@account-bridge/proxy`** — local OpenAI-compatible proxy for any SDK/CLI
- **`@account-bridge/overlay`** — FAB overlay on any page without React
- **`ConsumerFundingGate`** — settings tabs for My accounts vs App credits

See [`docs/wallet-billing.md`](docs/wallet-billing.md) and [`CHANGELOG.md`](CHANGELOG.md#300--2026-06-24).

## What's new in v2.1

- **3-step onboarding** — guided setup when no providers are connected yet
- **Friendlier errors** — copilot shows plain-language messages with **Try again** and **Dismiss**
- **Composer hints** — `Enter to send · Shift+Enter for new line`; focus returns after each reply
- **Recommended provider** — OpenAI card highlighted for first-time users
- **Embed pending state** — animated “Almost ready” while waiting for a connection (Web Components)
- **Enter to connect** — paste API key and press Enter in settings

## What's new in v2.0

Stable OSS release with three integration paths:

| Path | Package | Use when |
|------|---------|----------|
| **React** | `@account-bridge/react` | Lovable, Next.js, Vite + React |
| **Web Components** | `@account-bridge/web` | Static HTML, vanilla JS, non-React hosts |
| **Server** | `@account-bridge/server` | Express/Fastify host + encrypted storage |

**2.0 highlights:**

- **OAuth auto-refresh** — Google + Microsoft tokens refresh before validate/chat (`oauthRefresh` on server bridge)
- **`@account-bridge/web`** — `<account-bridge-embed>`, `<account-bridge-settings>`, `<account-bridge-copilot>` custom elements
- **M365 Copilot production guide** — [`docs/providers/microsoft-copilot-2.0.md`](docs/providers/microsoft-copilot-2.0.md)
- **Copilot UX** — provider badge before first message, per-turn `providerId`, conversation reset for M365
- **Breaking cleanup** — removed `headlessCopilotCss`; canonical `createBrowserHostBridge`

Migration: [`CHANGELOG.md`](CHANGELOG.md#200--2026-06-23).

```html
<!-- Web Components (no React) -->
<account-bridge-embed app-id="my-app" transport="local" mode="full"></account-bridge-embed>
<script type="module">
  import { registerAccountBridgeElements } from '@account-bridge/web';
  registerAccountBridgeElements();
</script>
```

See [`examples/vanilla-demo`](examples/vanilla-demo) and [`docs/universal-embed.md`](docs/universal-embed.md).

## What's new in v0.7

- **Copilot UX** — active provider badge + icon in chat header, multi-provider picker, M365-specific empty state and suggested prompts
- **`copilotProviderId`** — lock chat to `microsoft_copilot` (disables streaming automatically)
- **Demo: Remote + M365 Copilot** — vite demo pairs with `examples/node-proxy` (CORS + health check)
- **`copilotDefaultsForProvider()`** — shared title/subtitle/prompt presets

## What's new in v0.6

- **`theme="auto"`** — follows OS light/dark preference (`useResolvedThemeMode`)
- **Connection status bar** — connected provider pills + ready count in settings
- **Action notices** — brief confirmation after connect/disconnect
- **Suggested prompts** — one-click starter chips in empty copilot state
- **Mobile FAB sheet** — full-width bottom panel on small screens; focus moves into panel on open
- **`useConnectionSummary`** — hook for host nav badges and status chrome

## What's new in v0.5

- **Refined UI** — Plus Jakarta theme, light/dark gradients, pill actions, compact settings for sidebars and FAB gates
- **Smarter FAB panel** — backdrop dismiss, Escape to close, open/close FAB states, `theme` prop on `AccountBridgeCopilotPanel`
- **`compact` settings** — tighter provider cards inside panel gates and narrow layouts
- **Interactive demo** — vite preview switches embed mode (settings / gate / chat / panel / full) and theme

## What's new in v0.4

- **Universal embed** — `AccountBridgeEmbed` + `mountAccountBridgeHost` — one integration for any host app
- **`appId` isolation** — scoped credentials per product (`centralr2-core`, `r2works`, …)
- **`createBrowserHostBridge` / `createLocalAccountBridge`** — browser local vs remote transport helpers
- See [`docs/universal-embed.md`](docs/universal-embed.md)

## What's new in v0.3

- **Developer + consumer split** — `mountAccountBridgeHost`, `createBrowserHostBridge`, `ConsumerFundingGate`
- **Consumer credit enforcement** — gateway blocks host/provider keys; forces connected consumer credentials
- **OpenAI-compatible gateway** — `@account-bridge/gateway` + Express adapter
- **AccountBridgeSettings UI** — provider cards, Google OAuth for Gemini, guided API key UX, test connection, default provider
- **AccountBridgeCopilot** — multi-turn chat UI + floating FAB panel; consumer credits only
- **Microsoft Copilot provider** — `microsoft_copilot` via M365 Graph Chat API + Entra OAuth (opt-in)
- **OAuth + SQL store** — `@account-bridge/server` with Google PKCE and Postgres `SqlCredentialStore`
- **OpenAI-compatible providers** — Groq, Together, Mistral, Ollama via factory
- **Credential schema v2** — `api_key` and `oauth` envelopes with v1 migration

## Quickstart (any app)

**Interactive walkthrough:** from repo root after `npm run build`, run `npm run demo` and open http://localhost:5175 — see [`docs/walkthrough-demo.md`](docs/walkthrough-demo.md).

```bash
npm install @account-bridge/react @account-bridge/server
```

Embed in React:

```tsx
import { AccountBridgeEmbed } from '@account-bridge/react';
import { accountBridgeThemeCss } from '@account-bridge/ui';

<AccountBridgeEmbed appId="my-app" transport="remote" baseUrl="https://myapp.com" getAuthHeaders={...} mode="gate">
  <MyAiFeature />
</AccountBridgeEmbed>
```

Full guide: [`docs/universal-embed.md`](docs/universal-embed.md).

## Quickstart (imperative)

```bash
npm install @account-bridge/core
```

```ts
import {
  createAccountBridge,
  createDefaultProviders,
  memoryStorage,
  deriveKeyFromSecret,
} from '@account-bridge/core';

const bridge = createAccountBridge({
  storage: memoryStorage(),
  providers: createDefaultProviders(),
  getEncryptionKey: async () => ({
    key: await deriveKeyFromSecret(process.env.USER_SESSION_SECRET!, 'my-app'),
  }),
});

await bridge.connect('openai', { kind: 'api_key', apiKey: 'sk-...' });
const { client } = await bridge.resolveClient();
const result = await client.complete([{ role: 'user', content: 'Hello' }]);
```

Host integrators: see [`docs/quickstart-host.md`](docs/quickstart-host.md).

## Packages

| Package | Description |
|---------|-------------|
| `@account-bridge/core` | Credential manager, providers, registry |
| `@account-bridge/gateway` | OpenAI-compatible `/v1/*` HTTP handlers |
| `@account-bridge/adapters` | OpenAI SDK, Vercel AI, Express presets |
| `@account-bridge/server` | SQL store + Google OAuth routes |
| `@account-bridge/ui` | Headless settings + copilot controllers, shadcn/headless presets |
| `@account-bridge/react` | `AccountBridgeEmbed`, `ConsumerFundingGate`, `useBridgeFundingReady` |
| `@account-bridge/billing` | Wallet ledger + Stripe top-up |
| `@account-bridge/proxy` | Local OpenAI-compatible CLI proxy |
| `@account-bridge/overlay` | Framework-agnostic FAB overlay |
| `@account-bridge/mcp` | MCP stdio server |

## Development

```bash
npm ci
npm run check   # typecheck + unit tests + smoke + build
```

## License

MIT
