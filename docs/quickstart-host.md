# Quickstart for hosts (5 minutes)

Integrate Account Bridge so **developers** mount routes once and **consumers** connect their own AI credits. See [`developer-contract.md`](./developer-contract.md) for enforcement rules.

## 1. Install packages

```bash
npm install @account-bridge/core @account-bridge/gateway @account-bridge/adapters @account-bridge/server @account-bridge/react
```

## 2. Mount gateway on Express

```ts
import express from 'express';
import { mountAccountBridgeGateway } from '@account-bridge/adapters/express';
import { createAccountBridge, createDefaultProviders, deriveKeyFromSecret } from '@account-bridge/core';
import { sqlCredentialStore, SQL_MIGRATION } from '@account-bridge/server';

const app = express();
app.use(express.json());

function createBridge(userId: string) {
  return createAccountBridge({
    storage: sqlCredentialStore({ query: pool.query.bind(pool) }),
    providers: createDefaultProviders(),
    userId,
    getEncryptionKey: async () => ({
      key: await deriveKeyFromSecret(process.env.BRIDGE_ENCRYPTION_SECRET!, userId),
    }),
  });
}

mountAccountBridgeGateway(app, {
  resolveUser: (req) => validateHostJwt(req.headers.authorization),
  createBridge,
});
```

Run `SQL_MIGRATION` on your Postgres (or use Supabase reference migration).

## 3. Mount consumer settings API

```ts
import { mountAccountBridgeHostRoutes } from '@account-bridge/server';

mountAccountBridgeHostRoutes({
  app,
  resolveUser: (req) => validateHostJwt(req.headers.authorization),
  createBridge,
  enforceConsumerCredits: true, // default
});
```

Consumers connect via `POST /account-bridge/connect` or the React settings UI.

## 4. Add OAuth (Google → Gemini)

```ts
import { mountAccountBridgeOAuth, memoryOAuthStateStore } from '@account-bridge/server';

mountAccountBridgeOAuth({
  app,
  google: {
    clientId: process.env.GOOGLE_OAUTH_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
    redirectUri: process.env.GOOGLE_OAUTH_REDIRECT_URI!,
  },
  stateStore: memoryOAuthStateStore(),
  resolveUser: (req) => validateHostJwt(String(req.headers.authorization ?? '')),
  createBridge,
  successRedirect: '/settings?connected=gemini',
});
```

## 5. Drop in consumer settings UI

```tsx
import { AccountBridgeProvider, ConsumerFundingGate, AccountBridgeSettings } from '@account-bridge/react';
import { createBrowserHostBridge } from '@account-bridge/core';

const bridge = createBrowserHostBridge({
  appId: 'my-app',
  baseUrl: 'https://your-app.com',
  getAuthHeaders: () => ({ Authorization: `Bearer ${sessionJwt}` }),
});

<AccountBridgeProvider bridge={bridge}>
  <ConsumerFundingGate
    fundingPolicy={{ mode: 'auto', wallet: { enabled: true } }}
    baseUrl="https://your-app.com"
    getAuthHeaders={() => ({ Authorization: `Bearer ${sessionJwt}` })}
  >
    <YourAiFeature />
  </ConsumerFundingGate>
</AccountBridgeProvider>
```

For BYOK-only hosts, omit `fundingPolicy` / wallet props (defaults to `mode: 'byok'`).

## 6. Point AI tools at the gateway (consumer session JWT)

```ts
import { createBridgeOpenAI } from '@account-bridge/adapters/openai';

const preset = createBridgeOpenAI({
  gatewayUrl: 'https://your-app.com',
  userToken: hostSessionJwt,
});
// Use preset.baseURL + preset.defaultHeaders with OpenAI SDK, LangChain, Vercel AI SDK, etc.
```

**Exit gate:** `GET /health` → 200; user connects Gemini via Google OAuth or OpenAI via guided key; `POST /v1/chat/completions` returns assistant text with host JWT.
