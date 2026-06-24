# @account-bridge/mcp

MCP stdio server for connecting user-owned AI API keys and running chat from Cursor or other MCP clients.

## Setup

```bash
cp .env.example .env
# Set ACCOUNT_BRIDGE_ENCRYPTION_SECRET
npm run build
```

## Cursor config (`~/.cursor/mcp.json`)

```json
{
  "mcpServers": {
    "account-bridge": {
      "command": "node",
      "args": ["/absolute/path/to/account-bridge/packages/mcp/dist/index.js"],
      "env": {
        "ACCOUNT_BRIDGE_ENCRYPTION_SECRET": "your-local-secret"
      }
    }
  }
}
```

## Tools

| Tool | Description |
|------|-------------|
| `account_bridge_list_providers` | Connection status + default provider |
| `account_bridge_connect` | Validate + store API key (any registered provider id) |
| `account_bridge_disconnect` | Remove stored key |
| `account_bridge_set_default` | Set default provider for `resolveClient` |
| `account_bridge_chat` | Chat via default or named provider (optional `stream: true`) |

Credentials are encrypted at rest under `~/.account-bridge/mcp/`.
