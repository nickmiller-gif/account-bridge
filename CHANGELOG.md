# Changelog

## 3.4.0 — 2026-07-01

Optional integration — ship Account Bridge dark and flip it on with config.

### Added

- **`enabled` prop on `AccountBridgeEmbed`** — `enabled={false}` renders `children` untouched:
  no bridge, no storage, no gating. Hosts can mount the embed unconditionally behind a flag
  that defaults off.
- **`mountOptionalAccountBridge`** (`@account-bridge/web`, also on the script bundle) — mounts a
  bridge custom element only when a host feature flag parses truthy; disabled is a strict no-op
  (no element registration, no DOM). Returns `{ mounted, element, reason, unmount }`.
- **`isAccountBridgeEnabled`** — env-var flag parser with opt-in semantics: absent/empty and
  `0/false/no/off/disabled` are off; any other value (including a bundle URL) is on.
- **Docs** — [`docs/optional-integration.md`](docs/optional-integration.md): the three optional
  paths (React `enabled` prop, imperative mount, runtime-loaded bundle with no build-time
  dependency) plus the R2 ecosystem `VITE_ACCOUNT_BRIDGE_EMBED_URL` convention.
- **Tests** — `optional.test.ts` (flag parsing, no-op mount, attribute wiring),
  `optionalEmbed.test.ts` (disabled embed renders children verbatim).

## 3.3.0 — 2026-06-24

Platform hardening — auth, quotas, validation, and production guardrails.

### Added

- **`demoMode` gate** — production hosts must supply `resolveConsumerUser`; demo auth isolated to `demoMode: true`
- **Input validation** — email, slug (reserved words, length), strict funding policy parsing
- **Account-wide quota enforcement** — live store reads; usage counted only on successful responses
- **Signup rate limiting** — per-IP hourly cap with generic duplicate-email message
- **JSON body limits** — 256kb default on platform + tenant routers
- **Atomic file store writes** — temp file + rename, `0600` permissions
- **Tests** — `validation.test.ts`, `mountPlatformService.test.ts` (401, 429, rotate-secret)
- **Smokes** — negative auth + reserved slug rejection

### Changed

- **`past_due`** hosts blocked on tenant routes (not only `canceled`)
- **Live app state** — status/funding/quota read from store per request
- **CORS** — reject `OPTIONS` from unknown origins; validate configured origins
- **hostRoutes / walletRoutes** — `ConsumerCreditsRequiredError` returns 403, not 500
- **Client errors** — sanitized via `platformClientError` (no internal leakage)

## 3.2.0 — 2026-06-24

Host console polish and tenant app lifecycle API.

### Added

- **`PATCH /platform/v1/apps/:slug`** — update display name and funding policy (live on tenant routes via `resolveFundingPolicy`)
- **`POST /platform/v1/apps/:slug/rotate-secret`** — invalidate prior `ab_sk_…` and mint a new secret
- **Usage metrics** — `usage` block on `/platform/v1/me` (host aggregate + per-app bars in dashboard)
- **Plan wallet gate** — Free plan rejects wallet/auto wallet modes at app create/update
- **`usageFromCount` / `assertFundingPolicyAllowed`** helpers in `@account-bridge/platform`

### Changed

- Host dashboard — funding mode selector, usage progress bars, copy buttons, demo tenant banner, rotate secret
- Demo seed host upgraded to **Pro (trialing)** so walkthrough wallet chat works under plan rules
- Tenant routers reload funding policy from store on each request

## 3.1.0 — 2026-06-24

Sellable multi-tenant SaaS layer — host console, tenant APIs, and embed publishable keys.

### Added

- **`@account-bridge/platform`** — host signup, apps, plans (Free / Pro / Business), API keys (`ab_host_`, `ab_pk_`, `ab_sk_`)
- **`mountPlatformService`** — `/platform/v1/*` control plane + per-tenant routes at `/t/{slug}/*`
- **`filePlatformStore`** — JSON persistence via `PLATFORM_STORE_FILE` (demo / single-node)
- **Tenant wallet + mock AI** — shared wallet ledger and demo host key pool on tenant routers
- **`/platform/v1/demo-tenant`** — walkthrough helper when `PLATFORM_SEED_DEMO=1`
- **Examples** — `examples/platform-service`, `examples/platform-dashboard`
- **Scripts** — `npm run demo:platform`, `npm run demo -- --with-platform`
- **Docs** — [`docs/platform-saas.md`](docs/platform-saas.md)
- **Smokes** — extended `smoke:platform` (demo tenant wallet chat + signup flow)

### Changed

- **`AccountBridgeEmbed`** / Web Components — `publishableKey` / `publishable-key` attribute for hosted tenants
- **`createBrowserHostBridge`** — sends `X-Account-Bridge-Publishable-Key` when configured
- Platform dashboard plans UI uses `maxMonthlyRequests` from API

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
