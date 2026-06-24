# Supabase hosting reference

Account Bridge v3 ships an optional Supabase reference under `@account-bridge/server/supabase`.

## Migration

Apply [`packages/server/supabase/migrations/20260623000000_account_bridge.sql`](../packages/server/supabase/migrations/20260623000000_account_bridge.sql):

- `account_bridge_credentials` — encrypted credential blobs per user/provider
- `account_bridge_preferences` — default provider id
- RLS: `auth.uid() = user_id` on all rows

### Wallet tables (v3)

Apply [`WALLET_SQL_MIGRATION`](../packages/billing/src/sqlWallet.ts) (exported from `@account-bridge/billing`) for app-credit billing:

- `account_bridge_wallets` — per-user, per-app microcredit balance
- `account_bridge_ledger` — immutable debit/credit ledger with idempotency keys
- `account_bridge_pricing` — optional per-app/provider/model rate overrides

Recommended RLS (service role on server only for debits; consumers read own balance via host API):

```sql
ALTER TABLE account_bridge_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE account_bridge_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY wallet_select_own ON account_bridge_wallets
  FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY ledger_select_own ON account_bridge_ledger
  FOR SELECT USING (auth.uid()::text = user_id);
```

**Do not** expose wallet debits from the browser — gateway debits run server-side via `mountAccountBridgeHost` + `WalletStore`.

## SQL store from Supabase client (service role on server only)

```ts
import { createClient } from '@supabase/supabase-js';
import { sqlCredentialStore, mountAccountBridgeHost } from '@account-bridge/server';
import { sqlWalletStore, createSqlWalletPricingLoader } from '@account-bridge/billing';

const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const query = async (sql: string, params: unknown[] = []) => {
  const { data, error } = await admin.rpc('exec_sql', { sql, params }); // host implements RPC
  if (error) throw error;
  return { rows: data ?? [] };
};

const storage = sqlCredentialStore({ query });
const wallet = sqlWalletStore({ query });
const walletPricingLoader = createSqlWalletPricingLoader({ query });

mountAccountBridgeHost({
  app,
  config: {
    appId: 'my-app',
    baseUrl: process.env.APP_URL!,
    encryptionSecret: process.env.BRIDGE_ENCRYPTION_SECRET!,
    fundingPolicy: { mode: 'auto', wallet: { enabled: true } },
  },
  wallet,
  walletPricingLoader,
  resolveUser: (req) => /* validate session JWT */,
});
```

For direct Postgres access, pass `pg.Pool#query` instead (see [`quickstart-host.md`](./quickstart-host.md)). Use `transaction` on the pool when available so debits are atomic.

## Stripe webhook raw body

Mount the webhook **before** `express.json()`:

```ts
import express from 'express';
import { mountAccountBridgeWalletRoutes, stripeWebhookRawBody } from '@account-bridge/server';

app.post(
  '/account-bridge/wallet/webhook',
  express.raw({ type: 'application/json' }),
  stripeWebhookRawBody,
  // wallet routes mount the handler on the same path via mountAccountBridgeWalletRoutes
);
```

Or register wallet routes first and ensure only the webhook path uses `express.raw`.

## Edge OAuth callback template

Import `EDGE_OAUTH_CALLBACK_TEMPLATE` from `@account-bridge/server/supabase` or copy from [`packages/server/src/supabase/index.ts`](../packages/server/src/supabase/index.ts).

Set Edge secret `ACCOUNT_BRIDGE_SERVER_URL` to your Node host that runs `mountAccountBridgeOAuth`.

## Security notes

- Never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser.
- Browser clients use anon key + RLS on preferences/credentials if you allow direct reads; prefer host API for connect/disconnect and wallet top-up.
- Rotate OAuth client secrets in host env only.
- Host pool keys (`ACCOUNT_BRIDGE_POOL_*`) are server-only — never ship to clients.

See also [`wallet-billing.md`](./wallet-billing.md) for funding modes and gateway `402` handling.
