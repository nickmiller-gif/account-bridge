# Vite + React walkthrough demo

Interactive tour of Account Bridge **3.0** — BYOK, wallet credits, remote host, and feature gates.

## Run (recommended)

From **account-bridge** repo root (after `npm ci && npm run build`):

```bash
npm run demo
```

Opens:

- **http://localhost:5175** — this UI with guided scenarios in the sidebar
- **http://localhost:3456** — wallet host with mock AI (no OpenAI key needed)

Optional node-proxy for scenario 3:

```bash
npm run demo -- --with-proxy
```

Full narrative: [`docs/walkthrough-demo.md`](../../docs/walkthrough-demo.md).

## Run UI only

```bash
cd examples/vite-demo
npm install
npm run dev
```

For wallet scenario 2, also start `examples/wallet-host` in another terminal.

## Scenarios

| # | Name | What you learn |
|---|------|----------------|
| 1 | BYOK local | API keys encrypted in browser |
| 2 | Wallet credits | App credits + host pool (mock AI) |
| 3 | Remote host | Server-side credentials + gateway |
| 4 | Feature gate | `mode="gate"` unlock pattern |
