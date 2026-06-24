import type { AiProviderDefinition, ChatClient, ProviderId } from './types.js';
import { ProviderUnavailableError } from './errors.js';

const ENV_KEY_MAP: Record<string, string> = {
  openai: 'ACCOUNT_BRIDGE_POOL_OPENAI_KEY',
  anthropic: 'ACCOUNT_BRIDGE_POOL_ANTHROPIC_KEY',
  gemini: 'ACCOUNT_BRIDGE_POOL_GEMINI_KEY',
  groq: 'ACCOUNT_BRIDGE_POOL_GROQ_KEY',
  together: 'ACCOUNT_BRIDGE_POOL_TOGETHER_KEY',
  mistral: 'ACCOUNT_BRIDGE_POOL_MISTRAL_KEY',
};

export interface HostKeyPool {
  has(providerId: ProviderId): boolean;
  resolveClient(providerId: ProviderId): Promise<{ client: ChatClient; providerId: ProviderId }>;
}

export interface HostKeyPoolOptions {
  providers: AiProviderDefinition[];
  /** Override env lookup — for tests */
  getEnvKey?: (providerId: ProviderId) => string | undefined;
  fetch?: typeof fetch;
}

export function createHostKeyPool(options: HostKeyPoolOptions): HostKeyPool {
  const providerMap = new Map(options.providers.map((p) => [p.id, p]));
  const fetchImpl = options.fetch ?? fetch;

  function readPoolKey(providerId: ProviderId): string | undefined {
    if (options.getEnvKey) {
      return options.getEnvKey(providerId)?.trim() || undefined;
    }
    const envName = ENV_KEY_MAP[providerId];
    if (!envName) return undefined;
    const value = process.env[envName];
    return value?.trim() || undefined;
  }

  return {
    has(providerId) {
      return Boolean(readPoolKey(providerId));
    },

    async resolveClient(providerId) {
      const provider = providerMap.get(providerId);
      if (!provider) throw new ProviderUnavailableError(providerId);
      const apiKey = readPoolKey(providerId);
      if (!apiKey) {
        throw new ProviderUnavailableError(providerId);
      }
      const client = provider.createChatClient({ kind: 'api_key', apiKey }, fetchImpl);
      return { client, providerId };
    },
  };
}
