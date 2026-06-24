# Walkthrough demo

Hands-on tour of Account Bridge **3.0** — BYOK, wallet credits, remote host, and feature gates.

## One command

From the repo root (after `npm ci && npm run build`):

```bash
npm run demo
```

Waits until wallet-host and vite-demo respond before printing URLs. Servers bind **127.0.0.1** only.

| Service | Port | Purpose |
|---------|------|---------|
| **vite-demo** | 5175 | Interactive UI with guided scenarios |
| **wallet-host** | 3456 | Wallet + mock AI (no real OpenAI key) |

Optional remote-host scenario:

```bash
npm run demo -- --with-proxy
```

Also starts **node-proxy** on 3920 for server-side credential storage.

**Regression:** `npm run smoke:wallet-host` hits the real Express wallet host.  
**Screenshots:** `npm run demo:screenshots` (run `npx playwright install chromium` once).

Open **http://localhost:5175** and use the **Walkthrough** panel in the sidebar.

---

## Scenario 1 — BYOK in the browser

**Who pays:** the consumer’s OpenAI / Anthropic / Gemini account.

1. In the demo sidebar, select scenario **1 · BYOK in the browser** (or leave defaults: Local + API keys + Full).
2. In the embed **Settings**, choose **OpenAI** and paste a real API key.
3. Switch to **Chat** (or stay in Full) and send a message.
4. Note the **provider badge** in the chat header — billing never touches your server.

**Integration snippet:**

```tsx
<AccountBridgeEmbed
  appId="my-app"
  transport="local"
  mode="full"
  localPassphrase={sessionPassphrase}
/>
```

Keys encrypt in the browser via Web Crypto (`localPassphrase` scopes storage per tab).

---

## Scenario 2 — App credits (wallet)

**Who pays:** consumer → host wallet; host uses a **pool key** for provider calls.

1. Run `npm run demo` (wallet-host must be on port 3456).
2. Select scenario **2 · App credits (wallet)**.
3. Open **Settings → App credits** — demo balance is pre-seeded.
4. **Without** connecting a provider, open **Chat** and send a message.
5. Reply starts with `Demo wallet reply:` — mock AI, no `OPENAI_API_KEY` required.

Try the **My accounts** tab to connect BYOK; with `fundingPolicy.mode: 'auto'`, BYOK wins when connected.

**Host mount (simplified):**

```js
import { memoryWalletStore } from '@account-bridge/billing';
import { mountAccountBridgeHost } from '@account-bridge/server';

mountAccountBridgeHost({
  app,
  config: {
    appId: 'wallet-demo',
    baseUrl: 'http://localhost:3456',
    encryptionSecret: process.env.ACCOUNT_BRIDGE_ENCRYPTION_SECRET,
    fundingPolicy: { mode: 'auto', wallet: { enabled: true } },
  },
  wallet: memoryWalletStore(),
  hostKeyPool: /* pool or demo mock */,
  resolveUser: (req) =>
    req.headers.authorization === 'Bearer demo' ? 'demo-user' : null,
});
```

Browser embed:

```tsx
<AccountBridgeEmbed
  appId="wallet-demo"
  transport="remote"
  baseUrl="http://localhost:3456"
  getAuthHeaders={() => ({ Authorization: 'Bearer demo' })}
  fundingPolicy={{ mode: 'auto', wallet: { enabled: true } }}
/>
```

---

## Scenario 3 — Remote host

**Who pays:** same as BYOK, but credentials live on **your** server (encrypted).

1. `npm run demo -- --with-proxy` **or** manually:
   ```bash
   cd examples/node-proxy && cp .env.example .env && npm run dev
   cd examples/vite-demo && npm run dev
   ```
2. Select scenario **3 · Remote host**.
3. Sidebar: **Remote** transport, **API keys** preset.
4. Connect in settings — keys encrypt server-side; browser only sends `Authorization: Bearer <session>`.

Health check:

```bash
curl http://localhost:3920/health
```

**Microsoft Copilot:** set `MICROSOFT_OAUTH_*` in `examples/node-proxy/.env`, restart, then pick **M365 Copilot** preset in the demo.

---

## Scenario 4 — Feature gate

**Pattern:** hide premium UI until funding is ready.

1. Select scenario **4 · Feature gate**.
2. Before connecting: only settings show; the green **AI feature unlocked** card is hidden.
3. Connect any provider → children render immediately.

```tsx
<AccountBridgeEmbed appId="my-app" transport="local" mode="gate" localPassphrase={pass}>
  <PremiumAiFeature />
</AccountBridgeEmbed>
```

Headless check: `ensureBridgeFundingReady(bridge)` from `@account-bridge/ui`.

---

## Embed modes (try in any scenario)

| Mode | What you get |
|------|----------------|
| `settings` | Provider cards only |
| `gate` | Settings until ready, then `children` |
| `copilot` | Inline chat |
| `panel` | FAB + sheet over your page |
| `full` | Settings + chat + FAB (demo default) |

---

## Other examples

| Path | Stack |
|------|--------|
| `examples/vanilla-demo` | Web Components, no React |
| `examples/wallet-host` | Minimal Express wallet server |
| `examples/node-proxy` | Full host + gateway + OAuth |
| `examples/langchain-demo` | LangChain + proxy |
| `examples/vercel-ai-demo` | Vercel AI SDK |

---

## Production checklist

- Replace demo `Bearer demo` with real session/JWT in `resolveUser`.
- Use `sqlWalletStore` + `WALLET_SQL_MIGRATION` instead of `memoryWalletStore`.
- Set `ACCOUNT_BRIDGE_POOL_*` on the server — never in the browser bundle.
- Set `ACCOUNT_BRIDGE_ENCRYPTION_SECRET` (32+ chars) in production.
- Choose SSE billing: `walletStreamDebit: 'after_content'` (default) vs `'before_stream'` (strict 402 before bytes).

See also: [`universal-embed.md`](./universal-embed.md), [`wallet-billing.md`](./wallet-billing.md).
