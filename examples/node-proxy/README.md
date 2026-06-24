# Node proxy example

Demonstrates the **server-side host pattern**: encrypted credential storage, OAuth (Google + Microsoft), OpenAI-compatible gateway, and consumer-credit enforcement.

## Run

```bash
# from repo root after npm ci && npm run build
cd examples/node-proxy
cp .env.example .env   # set PROXY_ENCRYPTION_SECRET at minimum
npm run dev
```

Health check:

```bash
curl http://localhost:3920/health
```

## Microsoft Copilot (M365)

1. Register an Entra app with delegated Graph permissions for the [Copilot Chat API](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/copilot-apis-overview).
2. Set in `.env`:

```env
MICROSOFT_OAUTH_CLIENT_ID=...
MICROSOFT_OAUTH_CLIENT_SECRET=...
MICROSOFT_OAUTH_REDIRECT_URI=http://localhost:3920/account-bridge/oauth/microsoft/callback
MICROSOFT_OAUTH_TENANT_ID=common
```

3. Restart the host — `/health` should show `"microsoftOAuth": true`.
4. Open the **vite demo** (`examples/vite-demo`), choose **Remote** + **M365 Copilot**, click **Connect with Microsoft** in settings.

CORS is enabled for `http://localhost:5175` so the vite demo can call this host from the browser.

## Vite demo pairing

Terminal 1:

```bash
cd examples/node-proxy && npm run dev
```

Terminal 2:

```bash
cd examples/vite-demo && npm run dev
```

In the demo sidebar: **Remote** transport → **M365 Copilot** preset → connect in **Full** or **Chat** mode.

## Legacy curl endpoints

Some older docs reference `/api/connect` — the v0.6+ host uses `mountAccountBridgeHost` routes under `/account-bridge/*` and `/v1/*` gateway. See [`docs/universal-embed.md`](../../docs/universal-embed.md).

## Production notes

- Replace demo `Bearer` tokens with real session/JWT validation in `resolveUser`.
- Use `SqlCredentialStore` (or your DB) instead of in-memory storage for multi-tenant hosts.
- Set `PROXY_ENCRYPTION_SECRET` in environment (see `.env.example`).
