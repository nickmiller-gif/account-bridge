# Wallet billing

Account Bridge **3.0** adds prepaid **app credits** so consumers without API keys can still use AI features—the host recoups usage via a wallet instead of eating provider costs.

## Funding modes

| `fundingPolicy.mode` | Who pays | How |
|----------------------|----------|-----|
| `byok` (default) | Consumer → provider | Connected API key / OAuth |
| `wallet` | Consumer → host wallet | Host key pool + ledger debit |
| `auto` | Consumer | BYOK if connected, else wallet |

Configure per `appId` on the server:

```ts
mountAccountBridgeHost({
  app,
  config: {
    appId: 'my-app',
    baseUrl: 'https://myapp.com',
    encryptionSecret: process.env.ACCOUNT_BRIDGE_ENCRYPTION_SECRET!,
    fundingPolicy: {
      mode: 'auto',
      wallet: { enabled: true, stripeWebhookPath: '/account-bridge/wallet/webhook' },
    },
  },
  wallet: sqlWalletStore({ query: pool.query.bind(pool) }),
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY!,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
    baseUrl: 'https://myapp.com',
  },
  resolveUser: (req) => sessionUserId(req),
});
```

## Host key pool (wallet only)

Server env vars — **never** sent to browsers:

- `ACCOUNT_BRIDGE_POOL_OPENAI_KEY`
- `ACCOUNT_BRIDGE_POOL_ANTHROPIC_KEY`
- `ACCOUNT_BRIDGE_POOL_GEMINI_KEY`

The gateway still rejects client `Authorization: Bearer sk-…` tokens.

## Wallet API

| Route | Method | Purpose |
|-------|--------|---------|
| `/account-bridge/wallet/balance` | GET | Balance + recent ledger |
| `/account-bridge/wallet/packs` | GET | Credit pack catalog |
| `/account-bridge/wallet/checkout` | POST | Stripe Checkout URL (`{ packId }`) |
| `/account-bridge/wallet/webhook` | POST | Stripe webhook (raw body + signature) |
| `/account-bridge/wallet/credit` | POST | Dev-only manual credit (`NODE_ENV !== production`) |

## SQL migration

Apply `WALLET_SQL_MIGRATION` from `@account-bridge/billing` alongside credential tables.

## Per-app SQL pricing

Optional rate overrides via `account_bridge_pricing` and `createSqlWalletPricingLoader`:

```ts
import { createSqlWalletPricingLoader } from '@account-bridge/billing';

mountAccountBridgeHost({
  walletPricingLoader: createSqlWalletPricingLoader({ query: pool.query.bind(pool) }),
  // ...
});
```

## Insufficient credits

Gateway and host chat routes return **402** with `{ code: 'insufficient_credits' }` when wallet balance is too low.

## Streaming (SSE) wallet debits

Wallet-funded **streaming** responses debit on a configurable schedule:

| `walletStreamDebit` | When | On debit failure |
|---------------------|------|------------------|
| `after_content` (**default**) | After model chunks, before `[DONE]` | **Best-effort** — bytes may already be flushed; failure is logged, stream still completes |
| `before_stream` | Before any SSE bytes | **Strict** — returns **402** with no streamed content |

Set on `mountAccountBridgeHost` (applies to gateway + host REST chat routes):

```ts
mountAccountBridgeHost({
  // ...
  walletStreamDebit: 'before_stream', // strict billing for SSE
});
```

Or on `createAccountBridgeGatewayHandlers` / `mountAccountBridgeGateway` only.

**Note:** `before_stream` debits an upfront token estimate (input + 500 output tokens). `after_content` debits from actual streamed length. Use idempotency keys so retries do not double-charge.

## Stripe optional

Install `stripe` on the host. Without Stripe, use dev `POST /account-bridge/wallet/credit` or admin scripts to seed balances.

## Consumer UX

When `wallet.enabled`, settings UI shows **My accounts** and **App credits** tabs. See `@account-bridge/react` `ConsumerFundingGate`.

Use `useBridgeFundingReady` or `useConnectionSummary` for host nav badges — both treat wallet balance as ready on remote hosts.
