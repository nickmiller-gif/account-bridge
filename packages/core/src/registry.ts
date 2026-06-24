import type { AiProviderDefinition } from './types.js';
import { anthropicProvider } from './providers/anthropic.js';
import { geminiProvider } from './providers/gemini.js';
import { microsoftCopilotProvider } from './providers/microsoftCopilot.js';
import { openaiProvider } from './providers/openai.js';
import {
  createOpenAICompatibleProvider,
  type OpenAICompatibleConfig,
} from './providers/openaiCompatible.js';

export interface ProviderRegistry {
  list(): AiProviderDefinition[];
  get(id: string): AiProviderDefinition | undefined;
  has(id: string): boolean;
  register(provider: AiProviderDefinition): void;
}

export interface ProviderRegistryOptions {
  extras?: AiProviderDefinition[];
  /** Opt-in — requires Entra OAuth on the host (default false) */
  includeMicrosoftCopilot?: boolean;
  /** Groq, Together, Mistral, Ollama presets (default true) */
  includeCompatProviders?: boolean;
}

const OPENAI_COMPAT_PRESETS: OpenAICompatibleConfig[] = [
  {
    id: 'groq',
    displayName: 'Groq',
    baseUrl: 'https://api.groq.com/openai',
    defaultModel: 'llama-3.3-70b-versatile',
  },
  {
    id: 'together',
    displayName: 'Together AI',
    baseUrl: 'https://api.together.xyz',
    defaultModel: 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
  },
  {
    id: 'mistral',
    displayName: 'Mistral',
    baseUrl: 'https://api.mistral.ai',
    defaultModel: 'mistral-small-latest',
  },
  {
    id: 'ollama',
    displayName: 'Ollama (local)',
    baseUrl: 'http://localhost:11434',
    defaultModel: 'llama3.2',
    apiKeyOptional: true,
  },
];

export function createDefaultProviders(options: ProviderRegistryOptions = {}): AiProviderDefinition[] {
  return createProviderRegistry(options).list();
}

export function createProviderRegistry(
  optionsOrExtras: ProviderRegistryOptions | AiProviderDefinition[] = {},
): ProviderRegistry {
  const options: ProviderRegistryOptions = Array.isArray(optionsOrExtras)
    ? { extras: optionsOrExtras }
    : optionsOrExtras;
  const map = new Map<string, AiProviderDefinition>();

  function register(provider: AiProviderDefinition): void {
    map.set(provider.id, provider);
  }

  register(openaiProvider());
  register(anthropicProvider());
  register(geminiProvider());
  if (options.includeMicrosoftCopilot) {
    register(microsoftCopilotProvider());
  }
  if (options.includeCompatProviders !== false) {
    for (const preset of OPENAI_COMPAT_PRESETS) {
      register(createOpenAICompatibleProvider(preset));
    }
  }
  for (const extra of options.extras ?? []) {
    register(extra);
  }

  return {
    list: () => [...map.values()],
    get: (id) => map.get(id),
    has: (id) => map.has(id),
    register,
  };
}
