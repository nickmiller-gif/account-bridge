# Vanilla Web Components demo

Static HTML host for **Account Bridge 2.0** using `@account-bridge/web` custom elements — no React.

## Run

```bash
# From account-bridge root (after npm install + build)
npm run build -w @account-bridge/web
cd examples/vanilla-demo
npm install
npm run dev
```

Open http://localhost:5174 — connect OpenAI or Anthropic with an API key, then use the embedded copilot.

## Snippet

```html
<account-bridge-embed
  app-id="my-app"
  transport="local"
  mode="full"
  theme="dark"
></account-bridge-embed>
<script type="module">
  import { registerAccountBridgeElements } from '@account-bridge/web';
  registerAccountBridgeElements();
</script>
```

For remote hosts, set `transport="remote"`, `base-url`, and handle `auth-callback` events for session tokens.

See also: [`examples/vite-demo`](../vite-demo) (React) and [`docs/universal-embed.md`](../../docs/universal-embed.md).
