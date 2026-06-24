# Developer contract — consumer credits

Account Bridge exists for **two audiences**:

| Audience | Goal |
|----------|------|
| **Developers (hosts)** | Integrate once; never pay for end-user AI usage |
| **Consumers (users)** | Connect their own provider account; control spend |

## Wallet mode (v3)

When `fundingPolicy.mode` is `wallet` or `auto`:

- Host configures **pool keys** via `ACCOUNT_BRIDGE_POOL_*` env vars (server only)
- Consumers top up **app credits** via Stripe or dev credit route
- Gateway returns **402** when balance is insufficient

See [`wallet-billing.md`](./wallet-billing.md).

## Golden rule

> **Never use host-owned provider API keys for consumer-facing AI features.**

Host env vars like `OPENAI_API_KEY` are for **your** ops (CI, internal tools). Consumer features must route through Account Bridge so **the signed-in user's connected credentials** are billed.

## Enforcement (built in)

When `enforceConsumerCredits: true` (default):

1. **Gateway** rejects `Authorization: Bearer sk-…` (provider keys masquerading as session tokens)
2. **Gateway** rejects `x-api-key` headers
3. **Gateway** rejects request bodies containing `api_key` / `apiKey`
4. **Host routes** apply the same session-token checks on `/account-bridge/*`

Consumers connect keys **only** via:

- `POST /account-bridge/connect` (API key or OAuth completion)
- OAuth redirect flow (`/account-bridge/oauth/google/start`)
- `AccountBridgeSettings` UI

## Developer integration (minimal)

```ts
import express from 'express';
import { mountAccountBridgeGateway } from '@account-bridge/adapters/express';
import { mountAccountBridgeHostRoutes, mountAccountBridgeOAuth } from '@account-bridge/server';
import { createAccountBridge, createDefaultProviders } from '@account-bridge/core';

const app = express();
app.use(express.json());

function createBridge(userId: string) {
  return createAccountBridge({ storage, providers: createDefaultProviders(), userId, getEncryptionKey });
}

mountAccountBridgeGateway(app, {
  resolveUser: (req) => sessionUserId(req.headers.authorization),
  createBridge,
});

mountAccountBridgeHostRoutes({
  app,
  resolveUser: (req) => sessionUserId(req.headers.authorization),
  createBridge,
});
```

Point LangChain / Vercel AI / Cursor at **`/v1/chat/completions`** with the **consumer session JWT**, not a provider key.

## Consumer integration (browser app)

Use `createBrowserHostBridge` so settings UI talks to your host API while chat uses the gateway:

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

`ConsumerFundingGate` blocks AI UI until BYOK or app credits are ready; it embeds settings + wallet tabs automatically. See [`ui-integration.md`](./ui-integration.md).

## Imperative guard (server handlers)

For BYOK-only hosts:

```ts
import { assertConsumerCreditsReady } from '@account-bridge/core';

const providerId = await assertConsumerCreditsReady(bridge);
const { client } = await bridge.resolveClient(providerId);
```

For wallet or `auto` hosts, use `ensureBridgeFundingReady` from `@account-bridge/ui` (or check `bridge.getFundingStatus()` on remote clients) so app credits count as ready.

## Anti-patterns

| Do not | Do instead |
|--------|------------|
| `OPENAI_API_KEY` in user-facing route handlers | Gateway + consumer session |
| Accept `apiKey` in chat POST bodies | `POST /account-bridge/connect` once |
| Store keys in localStorage plaintext | Host encrypted store or IndexedDB via core |
| Skip settings UI | `AccountBridgeSettings` or `ConsumerFundingGate` |

## Success check

- [ ] No host provider keys in user-facing code paths
- [ ] Gateway returns 403 without connected consumer provider
- [ ] Settings page lets consumer connect OAuth or API key
- [ ] AI tools use `baseURL` → your gateway with session JWT
