# Changelog

## 3.0.0 — 2026-06-24

Universal consumer-funded AI plugin — BYOK + wallet + attach layers.

### Added

- **`FundingPolicy`** — `byok` | `wallet` | `auto` per `appId`
- **`@account-bridge/billing`** — wallet ledger, usage metering, Stripe Checkout (optional peer `stripe`)
- **`resolveFundingSource`** — BYOK first in `auto`, wallet + host key pool fallback
- **`createHostKeyPool`** — server-only `ACCOUNT_BRIDGE_POOL_*` env keys for wallet mode
- **Gateway wallet debit** — post-completion metering, **402** `insufficient_credits`
- **`@account-bridge/proxy`** — `account-bridge-proxy` CLI for any OpenAI-compatible SDK
- **`@account-bridge/overlay`** — `mountAccountBridgeOverlay()` FAB on any page
- **`ConsumerFundingGate`** — BYOK + app credits tabs (replaces `ConsumerCreditGate` alias)
- **Wallet API** — `/account-bridge/wallet/balance`, `/checkout`, `/webhook`, `/packs`
- **MCP tools** — `funding_status`, `wallet_balance`, `wallet_top_up_url`
- **Examples** — `examples/wallet-host`
- **Docs** — [`docs/wallet-billing.md`](docs/wallet-billing.md)
- **Smokes** — `npm run smoke:wallet`, `npm run smoke:proxy`

### Changed

- All packages bumped to **3.0.0**
- `mountAccountBridgeHost` accepts `wallet`, `hostKeyPool`, `stripe`, `fundingPolicy`

## 2.1.0 — 2026-06-23

UX-focused release — onboarding, friendlier errors, composer hints.

### Added

- **3-step settings onboarding** for first-time users
- **`friendlyCopilotError()`** — plain-language API/network error copy
- **Copilot error card** with Try again / Dismiss (`dismissError`, `retryLast` on controller)
- **Composer keyboard hint** — Enter vs Shift+Enter
- **Recommended badge** on OpenAI provider card
- **Embed pending state** for Web Components waiting on connection
- **Enter to submit** API key in settings forms

### Changed

- Default settings intro copy is clearer and more welcoming
- Focus returns to composer textarea after each reply
- All workspace packages bumped to **2.1.0**

## 2.0.0 — 2026-06-23

Account Bridge **2.0** is the first stable OSS release: OAuth token lifecycle, Microsoft Copilot production path, Web Components package, and breaking API cleanup.

### Added

- **`AccountBridgeOptions.oauthRefresh`** — auto-refresh Google/Microsoft tokens before validate/chat; persists rotated tokens
- **`@account-bridge/web`** — `<account-bridge-settings>`, `<account-bridge-copilot>`, `<account-bridge-embed>` custom elements (headless UI controllers, no React)
- **`AccountBridgeEmbedConfig`** — shared embed type for React and Web Components
- **`ProviderCapabilities.streaming`** on `AiProviderDefinition` — explicit contract (`microsoft_copilot`: `false`)
- **`ChatClient.resetConversation()`** — M365 conversation reset on copilot clear
- **`CopilotMessage.providerId`** — per-assistant-turn attribution when switching providers mid-thread
- **Pre-connect provider badge** in copilot header when a provider is selected/connected
- **OAuth reconnect UX** in settings when refresh/validation fails
- **Docs:** [`docs/providers/microsoft-copilot-2.0.md`](docs/providers/microsoft-copilot-2.0.md)
- **Examples:** `examples/vanilla-demo` — static HTML + Web Components
- **Release workflow:** `.github/workflows/release.yml`

### Changed

- **`createBrowserHostBridge`** is the canonical browser host client name
- **`createHostBridgeClient`** remains as deprecated alias (console warning in non-production)
- **`mountAccountBridgeHost`** passes Google/Microsoft OAuth configs into server bridge for refresh
- Server **`refreshGoogleToken` / `refreshMicrosoftToken`** delegate to `@account-bridge/core` oauth refresh module
- All workspace packages bumped to **2.0.0**

### Removed (breaking)

- **`headlessCopilotCss`** — use `accountBridgeThemeCss` from `@account-bridge/ui`
- **`LegacyMountOAuthRoutesOptions`** — use `MountOAuthRoutesOptions` with optional `google` field

### Migration: 0.7 → 2.0

1. **CSS:** Replace `headlessCopilotCss` imports with `accountBridgeThemeCss` (already includes copilot styles).
2. **Host client:** Rename `createHostBridgeClient` → `createBrowserHostBridge` (alias still works with warning).
3. **Server hosts:** Ensure `mountAccountBridgeHost` receives `google` / `microsoft` OAuth configs so refresh works at chat time.
4. **Long-lived OAuth:** Connect flows must store `refreshToken`; 2.0 refreshes at use-time when `oauthRefresh` is configured.
5. **Vanilla / static apps:** Add `@account-bridge/web` and register elements, or load `account-bridge.web.js` IIFE bundle.
6. **M365:** Read [`docs/providers/microsoft-copilot-2.0.md`](docs/providers/microsoft-copilot-2.0.md); disable streaming expectations for `microsoft_copilot`.

## 0.7.0

Copilot UX (provider badge, picker, M365 demo wiring).

## 0.6.0

Theme auto, connection status bar, suggested prompts, mobile FAB sheet.

## 0.5.0

Plus Jakarta theme, FAB panel, interactive vite demo.
