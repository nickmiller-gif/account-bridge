# Provider catalog

| Provider ID | Display name | Auth | OAuth | Help |
|-------------|--------------|------|-------|------|
| `openai` | OpenAI | API key | No (platform limitation) | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| `anthropic` | Anthropic | API key | No | [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys) |
| `gemini` | Google Gemini | API key or Google OAuth | Yes (`google` → `gemini`) | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| `microsoft_copilot` | Microsoft Copilot | Microsoft OAuth only | Yes (`microsoft` → `microsoft_copilot`) | [Copilot APIs overview](https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/copilot-apis-overview) |
| `groq` | Groq | API key | No | [console.groq.com/keys](https://console.groq.com/keys) |
| `together` | Together AI | API key | No | [api.together.xyz/settings/api-keys](https://api.together.xyz/settings/api-keys) |
| `mistral` | Mistral | API key | No | [console.mistral.ai](https://console.mistral.ai) |
| `ollama` | Ollama (local) | Optional key | No | [ollama.com](https://ollama.com) |

## Default models

Built-in defaults when credential metadata omits `defaultModel`:

- OpenAI: `gpt-4o-mini`
- Anthropic: `claude-3-5-haiku-latest`
- Gemini: `gemini-2.0-flash`
- Microsoft Copilot: `microsoft-copilot` (Graph Chat API — not an OpenAI model id)
- Groq: `llama-3.3-70b-versatile`
- Together: `meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo`
- Mistral: `mistral-small-latest`
- Ollama: `llama3.2`

Tower Negotiator / M365 Copilot-only apps: see [`docs/providers/microsoft-copilot.md`](providers/microsoft-copilot.md).

## Custom providers

Register OpenAI-compatible endpoints without forking:

```ts
import { createOpenAICompatibleProvider, createProviderRegistry } from '@account-bridge/core';

const registry = createProviderRegistry([
  createOpenAICompatibleProvider({
    id: 'azure-openai',
    displayName: 'Azure OpenAI',
    baseUrl: 'https://YOUR-RESOURCE.openai.azure.com/openai/deployments/YOUR-DEPLOYMENT',
    defaultModel: 'gpt-4o',
  }),
]);
```
