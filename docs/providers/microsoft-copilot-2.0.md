# Microsoft Copilot 2.0

Account Bridge **2.0** ships production-grade Microsoft 365 Copilot via the Graph beta Copilot API. This guide covers Entra app registration, scopes, host wiring, and troubleshooting.

## Requirements

- Microsoft 365 tenant with **Copilot for Microsoft 365** licensed for the connecting user
- Entra (Azure AD) app registration with client secret (confidential client)
- Account Bridge host with `@account-bridge/server` OAuth routes and encrypted credential storage
- **OAuth refresh** configured on the server bridge (`googleOAuth` / `microsoftOAuth` via `mountAccountBridgeHost`)

Streaming is **not supported** in 2.0 — `microsoft_copilot` sets `capabilities.streaming: false` and copilot UIs disable stream automatically.

## Entra app registration

1. Azure Portal → **App registrations** → New registration
2. Supported account types: **Accounts in any organizational directory** (multitenant) or single tenant
3. Redirect URI (Web): `https://YOUR_HOST/account-bridge/oauth/microsoft/callback` (match your `oauthBasePath`)
4. **Certificates & secrets** → New client secret → copy value to host env
5. **API permissions** → Microsoft Graph **Delegated** permissions:

| Permission | Purpose |
|------------|---------|
| `openid`, `profile`, `offline_access` | OAuth baseline + refresh tokens |
| `Chat.Read` | Copilot conversation API |
| `ChannelMessage.Read.All` | Team context (optional) |
| `Mail.Read`, `People.Read.All`, `Sites.Read.All`, … | Copilot grounding (see `MICROSOFT_COPILOT_OAUTH_SCOPES` in core) |

Grant admin consent if your tenant requires it.

## Host configuration

```ts
import { mountAccountBridgeHost } from '@account-bridge/server';

mountAccountBridgeHost(app, {
  config: { appId: 'my-app', encryptionSecret: process.env.AB_ENCRYPTION_SECRET! },
  microsoft: {
    clientId: process.env.MS_CLIENT_ID!,
    clientSecret: process.env.MS_CLIENT_SECRET!,
    redirectUri: 'https://myapp.com/account-bridge/oauth/microsoft/callback',
    tenantId: 'common', // or your tenant GUID
  },
});
```

OAuth refresh runs automatically when `microsoftOAuth` is passed through `createServerBridgeFactory` (wired by `mountAccountBridgeHost`).

## Client embed

**React:**

```tsx
<AccountBridgeEmbed
  appId="my-app"
  transport="remote"
  baseUrl="https://myapp.com"
  getAuthHeaders={() => ({ Authorization: `Bearer ${sessionToken}` })}
  includeMicrosoftCopilot
  copilotProviderId="microsoft_copilot"
  mode="full"
/>
```

**Web Components:**

```html
<account-bridge-embed
  app-id="my-app"
  transport="remote"
  base-url="https://myapp.com"
  include-microsoft-copilot
  copilot-provider-id="microsoft_copilot"
  mode="full"
></account-bridge-embed>
```

For auth in vanilla hosts, listen for `auth-callback` or set `auth-token` for demos.

## Conversation lifecycle

- Each M365 client keeps a Graph `conversationId` for multi-turn context
- **Clear chat** in copilot UI calls `ChatClient.resetConversation()` → new Graph conversation on next message
- Disconnect/reconnect in settings resets stored OAuth tokens

## Demo stack

1. `examples/node-proxy` — Express host with Microsoft OAuth + gateway
2. `examples/vite-demo` — React embed with Remote + M365 preset
3. `examples/vanilla-demo` — Web Components embed (local transport)

See each example README for env vars (`MS_CLIENT_ID`, `MS_CLIENT_SECRET`, CORS origin).

## Troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| **401** on Graph | Expired access token | Ensure `oauthRefresh.microsoft` on server; reconnect if refresh token revoked |
| **403** on Copilot API | Missing license or consent | Verify Copilot license; grant Graph permissions + admin consent |
| **403** "Reconnect in settings" | Refresh failed | User must complete OAuth again; check client secret rotation |
| Empty replies | Conversation API error | Check Graph audit; verify `Chat.Read` scope |
| Stream errors | M365 does not stream in AB 2.0 | Use `stream={false}` or `microsoft_copilot` defaults |

## Manual production gate (operator)

Not run in CI — validate once per tenant:

1. Complete Microsoft OAuth in settings
2. Send three turns in copilot; verify grounding uses M365 data
3. Clear chat; confirm new conversation (no stale thread bleed)
4. Wait until access token near expiry (or force `expiresAt` in storage); send another message — refresh should succeed without re-login
