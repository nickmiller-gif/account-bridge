# Account Bridge Platform (SaaS)

Sell Account Bridge as a **hosted multi-tenant service**. Host companies sign up, create apps, embed BYOK + wallet AI in their products, and pay monthly via Stripe.

## Packages

| Package | Role |
|---------|------|
| `@account-bridge/platform` | Host accounts, apps, API keys, plan limits |
| `@account-bridge/server` → `mountPlatformService` | REST API + per-tenant Account Bridge routes |
| `@account-bridge/billing` → `createPlatformSubscriptionCheckout` | Stripe subscription checkout + webhooks |

## Quick demo

```bash
npm run build
npm run demo:platform
```

- **Platform API** — `http://127.0.0.1:3460` (`/platform/v1/*`)
- **Host dashboard** — `http://127.0.0.1:5176` (signup, create apps, copy embed snippet)
- **Seeded tenant** — `http://127.0.0.1:3460/t/saas-demo` (walkthrough scenario 5 in vite-demo)

```bash
# In another terminal — walkthrough UI
npm run demo
# Select scenario "5 · Cloud SaaS (hosted)"
```

## Plans

| Plan | Price | Apps | Requests / month |
|------|-------|------|------------------|
| Free | $0 | 1 | 5,000 |
| Pro | $49 | 5 | 100,000 |
| Business | $199 | 25 | 1,000,000 |

Limits enforced at the tenant router (`429` when exceeded).

## Platform API

Base: `{origin}/platform/v1`

### Host auth

`Authorization: Bearer ab_host_…` (returned once from signup)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Service + plan catalog |
| GET | `/plans` | Plan details |
| POST | `/signup` | `{ email, name }` → `{ hostToken, host }` |
| GET | `/me` | Host profile + apps |
| POST | `/apps` | `{ slug, displayName, fundingPolicy? }` → `{ app, secretKey }` |
| PATCH | `/apps/:slug` | `{ displayName?, fundingPolicy? }` → `{ app }` |
| POST | `/apps/:slug/rotate-secret` | Rotate server secret → `{ app, secretKey }` |
| POST | `/billing/checkout` | `{ planId: "pro" \| "business" }` → Stripe Checkout URL |
| POST | `/billing/webhook` | Stripe subscription events (raw body) |

### Tenant API (per app)

Base: `{origin}/t/{slug}`

Same routes as self-hosted Account Bridge:

- `GET /account-bridge/status`
- `POST /account-bridge/providers/...`
- `POST /v1/chat/completions`

**Tenant auth** (required on every request):

- Browser embed: `X-Account-Bridge-Publishable-Key: ab_pk_…`
- Server integration: `Authorization: Bearer ab_sk_…`

**Consumer auth** (your end users):

- `Authorization: Bearer {your_session_jwt}` or demo header `X-Demo-User`

Wire production validation via `resolveConsumerUser` in `mountPlatformService`.

## Embed snippet

```tsx
<AccountBridgeEmbed
  transport="remote"
  appId="my-product"
  baseUrl="https://api.example.com/t/my-product"
  publishableKey="ab_pk_…"
  getAuthHeaders={() => ({ Authorization: `Bearer ${userSession}` })}
  mode="full"
/>
```

`publishableKey` is sent as `X-Account-Bridge-Publishable-Key` on every host API call.

## Self-hosting

```js
import express from 'express';
import { memoryPlatformStore } from '@account-bridge/platform';
import { mountPlatformService, registerExistingPlatformApps } from '@account-bridge/server';

const app = express();
const store = memoryPlatformStore(); // or SQL store via PLATFORM_SQL_MIGRATION

mountPlatformService({
  app,
  store,
  baseUrl: 'https://api.yourcompany.com',
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    baseUrl: 'https://dashboard.yourcompany.com',
    priceIds: { pro: 'price_…', business: 'price_…' },
  },
  resolveConsumerUser: async (req) => validateYourJwt(req),
});

await registerExistingPlatformApps({ app, store, baseUrl: 'https://api.yourcompany.com' });
app.listen(3460);
```

Persist hosts/apps with `PLATFORM_SQL_MIGRATION` from `@account-bridge/platform` (Postgres).

## Smoke test

```bash
npm run smoke:platform
```

Exit gate: `npm run check` includes platform smoke.

## Security notes

- **Tenant routes:** every path under `/t/{slug}` — including `/health` — requires `X-Account-Bridge-Publishable-Key` or `Bearer ab_sk_…`.
- **Production:** set `demoMode: false` on `mountPlatformService` and implement `resolveConsumerUser` (JWT/session validation). Demo bearer headers are rejected without `demoMode: true`.
- **Quotas:** enforced account-wide per host (sum of all app usage vs plan `maxMonthlyRequests`). Usage increments only on successful responses (`status < 400`).
- **Signup:** rate-limited per IP; duplicate emails return a generic error (no enumeration).
- **Input validation:** email format, slug length/reserved words, strict funding policy JSON.
- **File store:** atomic writes with `0600` permissions — still not a substitute for SQL + encrypted secrets at rest in production.
- Rotate keys by creating a new app or `POST /platform/v1/apps/:slug/rotate-secret`.
- Demo servers bind `127.0.0.1` and refuse `NODE_ENV=production`.
