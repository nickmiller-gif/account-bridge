# Microsoft Copilot provider (`microsoft_copilot`)

Route AI features through **Microsoft 365 Copilot** using the user's own M365 Copilot license and Entra sign-in — not the host app's API keys.

## Provider id

`microsoft_copilot`

## Auth

**OAuth only** (Microsoft Entra ID). There is no API-key path — users click **Connect with Microsoft** in Account Bridge settings.

Requires:

- Microsoft 365 **Copilot license** for the signed-in user
- Host-registered Entra app with delegated Graph permissions used by the [Copilot Chat API](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/api/ai-services/chat/copilotroot-post-conversations)

## Enable on the host

Microsoft Copilot is **opt-in** — it is not in the default provider registry.

### Server (recommended)

Use `mountAccountBridgeHost` with `includeMicrosoftCopilot: true` and Entra credentials:

```ts
import { mountAccountBridgeHost, memoryOAuthStateStore } from '@account-bridge/server';

mountAccountBridgeHost({
  app,
  config: {
    appId: 'my-app',
    baseUrl: 'https://myapp.com',
    getAuthHeaders: () => ({}),
    encryptionSecret: process.env.ACCOUNT_BRIDGE_ENCRYPTION_SECRET!,
    includeMicrosoftCopilot: true,
  },
  resolveUser: (req) => sessionUserId(req.headers.authorization),
  stateStore: memoryOAuthStateStore(),
  microsoft: {
    clientId: process.env.MICROSOFT_OAUTH_CLIENT_ID!,
    clientSecret: process.env.MICROSOFT_OAUTH_CLIENT_SECRET!,
    redirectUri: 'https://myapp.com/account-bridge/oauth/microsoft/callback',
    tenantId: process.env.MICROSOFT_OAUTH_TENANT_ID ?? 'common',
  },
});
```

Entra redirect URI pattern:

`https://{your-host}/account-bridge/oauth/microsoft/callback`

### Browser embed

```tsx
<AccountBridgeEmbed
  appId="my-app"
  transport="remote"
  baseUrl="https://myapp.com"
  getAuthHeaders={() => ({ Authorization: `Bearer ${sessionJwt}` })}
  includeMicrosoftCopilot
  providerIds={['microsoft_copilot']}
  introTitle="Connect Microsoft Copilot"
  introDescription="Sign in with your work account. Usage bills to your M365 Copilot license, not the app host."
  mode="gate"
>
  <MyAiFeature />
</AccountBridgeEmbed>
```

## Calling AI from app code

```ts
const { client } = await bridge.resolveClient('microsoft_copilot');

const result = await client.complete([
  { role: 'system', content: 'You are a helpful assistant for this product.' },
  { role: 'user', content: userPrompt },
]);
```

System prompts map to Graph `additionalContext`. Multi-turn reuse is handled inside the provider via a Copilot conversation id.

## Gateway / LangChain

Point tools at the OpenAI-compatible gateway with the consumer session JWT and header:

`x-account-bridge-provider: microsoft_copilot`

Streaming is not yet implemented for Microsoft Copilot (sync `/chat` only).

## API surface

| Step | Graph endpoint |
|------|----------------|
| Create conversation | `POST /beta/copilot/conversations` |
| Send message | `POST /beta/copilot/conversations/{id}/chat` |

Preview/beta — subject to Microsoft change. See [Copilot APIs overview](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/copilot-apis-overview).

## Pitfalls

- Personal Microsoft accounts are **not** supported — work/school Entra accounts only.
- All listed Graph delegated permissions are required for the Chat API.
- Host `OPENAI_API_KEY` must **not** power consumer AI — use `ConsumerFundingGate` or `mode="gate"` with `microsoft_copilot`.
