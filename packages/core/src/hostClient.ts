import { parseSseTextStream } from './streaming.js';
import {
  ConsumerFundingRequiredError,
  InvalidCredentialError,
  ProviderUnavailableError,
} from './errors.js';
import type {
  AccountBridge,
  AiProviderDefinition,
  BridgeChangeEvent,
  ChatClient,
  ChatCompletionOptions,
  ChatMessage,
  FundingStatus,
  ProviderId,
  ProviderStatus,
  ValidationResult,
} from './types.js';

export interface HostBridgeClientOptions {
  /** Host app origin, e.g. https://myapp.com */
  baseUrl: string;
  /** Returns Authorization and other headers for the signed-in consumer */
  getAuthHeaders: () => Promise<Record<string, string>> | Record<string, string>;
  /** API prefix for settings routes (default /account-bridge) */
  apiPrefix?: string;
  /** OAuth route prefix (default {apiPrefix}/oauth) */
  oauthBasePath?: string;
  /** OpenAI-compatible gateway path (default /v1/chat/completions) */
  gatewayPath?: string;
  /** Provider metadata for settings UI (defaults to empty — use createDefaultProviders() locally) */
  providers?: AiProviderDefinition[];
  fetch?: typeof fetch;
  /** @internal Set by createBrowserHostBridge to avoid duplicate deprecation noise */
  _suppressDeprecationWarning?: boolean;
  /** Platform publishable key sent as X-Account-Bridge-Publishable-Key */
  publishableKey?: string;
}

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/$/, '')}${path}`;
}

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text.trim()) return {};
  return JSON.parse(text) as unknown;
}

/**
 * Remote Account Bridge client for production apps:
 * - Consumers connect credentials via host REST API (server-side encrypted storage)
 * - AI features call the OpenAI-compatible gateway with the consumer session token
 */
export function createHostBridgeClient(options: HostBridgeClientOptions): AccountBridge {
  const isProd =
    typeof process !== 'undefined' && process.env?.NODE_ENV === 'production';
  if (
    !options._suppressDeprecationWarning &&
    !isProd &&
    typeof console !== 'undefined'
  ) {
    console.warn(
      '[account-bridge] createHostBridgeClient is deprecated; use createBrowserHostBridge from @account-bridge/core.',
    );
  }
  const fetchImpl = options.fetch ?? fetch;
  const prefix = options.apiPrefix ?? '/account-bridge';
  const gatewayPath = options.gatewayPath ?? '/v1/chat/completions';
  const providerMap = new Map<ProviderId, AiProviderDefinition>(
    (options.providers ?? []).map((p) => [p.id, p]),
  );
  const listeners = new Set<(event: BridgeChangeEvent) => void>();

  function emit(event: BridgeChangeEvent): void {
    for (const listener of listeners) listener(event);
  }

  async function authHeaders(): Promise<Record<string, string>> {
    const headers = await options.getAuthHeaders();
    if (options.publishableKey) {
      headers['X-Account-Bridge-Publishable-Key'] = options.publishableKey;
    }
    return { ...headers };
  }

  async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
    const headers = await authHeaders();
    return fetchImpl(joinUrl(options.baseUrl, `${prefix}${path}`), {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
        ...(init?.headers as Record<string, string> | undefined),
      },
    });
  }

  function gatewayChatClient(providerId?: ProviderId): ChatClient {
    async function throwGatewayError(res: Response): Promise<never> {
      const err = (await readJson(res)) as {
        error?: { message?: string; code?: string };
      };
      const message = err.error?.message ?? `Gateway request failed (${res.status})`;
      if (res.status === 402 || err.error?.code === 'insufficient_credits') {
        throw new ConsumerFundingRequiredError(message);
      }
      throw new Error(message);
    }

    return {
      async complete(messages: ChatMessage[], chatOptions?: ChatCompletionOptions) {
        const headers = await authHeaders();
        if (providerId) {
          headers['x-account-bridge-provider'] = providerId;
        }
        const res = await fetchImpl(joinUrl(options.baseUrl, gatewayPath), {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages,
            model: chatOptions?.model,
            max_tokens: chatOptions?.maxTokens,
            temperature: chatOptions?.temperature,
            stream: false,
          }),
        });
        if (!res.ok) {
          await throwGatewayError(res);
        }
        const data = (await res.json()) as {
          model: string;
          choices: Array<{ message: { content: string } }>;
          usage?: { prompt_tokens?: number; completion_tokens?: number };
        };
        return {
          content: data.choices[0]?.message?.content ?? '',
          model: data.model,
          usage: {
            inputTokens: data.usage?.prompt_tokens,
            outputTokens: data.usage?.completion_tokens,
          },
        };
      },

      async *stream(messages: ChatMessage[], chatOptions?: ChatCompletionOptions) {
        const headers = await authHeaders();
        if (providerId) {
          headers['x-account-bridge-provider'] = providerId;
        }
        const res = await fetchImpl(joinUrl(options.baseUrl, gatewayPath), {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages,
            model: chatOptions?.model,
            max_tokens: chatOptions?.maxTokens,
            temperature: chatOptions?.temperature,
            stream: true,
          }),
        });
        if (!res.ok) {
          await throwGatewayError(res);
        }
        yield* parseSseTextStream(res.body);
      },
    };
  }

  return {
    async connect(providerId, rawCredentials) {
      if (!providerMap.has(providerId) && options.providers?.length) {
        throw new ProviderUnavailableError(providerId);
      }
      const body =
        typeof rawCredentials === 'object' && rawCredentials !== null
          ? rawCredentials
          : { kind: 'api_key', apiKey: String(rawCredentials) };

      const res = await apiFetch('/connect', {
        method: 'POST',
        body: JSON.stringify({
          provider: providerId,
          ...(body as Record<string, unknown>),
          apiKey: (body as { apiKey?: string }).apiKey,
        }),
      });
      const data = (await readJson(res)) as ValidationResult & { error?: string };
      if (!res.ok) {
        throw new InvalidCredentialError(providerId, data.error ?? data.message ?? 'Connect failed');
      }
      emit({ type: 'connect', providerId });
      return { ok: true, message: data.message, metadata: data.metadata };
    },

    async disconnect(providerId) {
      const res = await apiFetch(`/connect/${encodeURIComponent(providerId)}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = (await readJson(res)) as { error?: string };
        throw new Error(data.error ?? `Disconnect failed (${res.status})`);
      }
      emit({ type: 'disconnect', providerId });
    },

    async has(providerId) {
      const list = await this.listProviders();
      return list.some((p) => p.providerId === providerId && p.connected);
    },

    async getClient(providerId) {
      return gatewayChatClient(providerId);
    },

    async resolveClient(providerId) {
      const resolved = providerId ?? (await this.getDefaultProvider());
      return {
        client: gatewayChatClient(resolved ?? undefined),
        providerId: resolved ?? 'openai',
      };
    },

    async getFundingStatus(): Promise<FundingStatus> {
      const res = await apiFetch('/status');
      if (!res.ok) {
        throw new Error(`Failed to load funding status (${res.status})`);
      }
      const data = (await res.json()) as FundingStatus & {
        walletBalanceMicrocredits?: number;
      };
      return {
        ready: Boolean(data.ready),
        fundingPolicy: data.fundingPolicy ?? { mode: 'byok' },
        walletBalanceMicrocredits: data.walletBalanceMicrocredits,
        walletEnabled: data.walletEnabled,
        connectedCount: data.connectedCount ?? 0,
        defaultProvider: data.defaultProvider ?? null,
      };
    },

    async validate(providerId) {
      const res = await apiFetch(`/validate/${encodeURIComponent(providerId)}`, { method: 'POST' });
      const data = (await readJson(res)) as ValidationResult & { error?: string };
      if (!res.ok) {
        return { ok: false, message: data.error ?? data.message ?? 'Validation failed' };
      }
      return data;
    },

    async listProviders() {
      const res = await apiFetch('/providers');
      if (!res.ok) {
        throw new Error(`Failed to list providers (${res.status})`);
      }
      const data = (await res.json()) as { providers: ProviderStatus[] };
      const statuses = data.providers ?? [];
      if (options.providers?.length) {
        return options.providers.map((p) => {
          const existing = statuses.find((s) => s.providerId === p.id);
          return existing ?? { providerId: p.id, connected: false };
        });
      }
      return statuses;
    },

    getProviderDefinition(providerId) {
      return providerMap.get(providerId);
    },

    async getDefaultProvider() {
      const res = await apiFetch('/providers');
      if (!res.ok) return null;
      const data = (await res.json()) as { defaultProvider?: ProviderId | null };
      return data.defaultProvider ?? null;
    },

    async setDefaultProvider(providerId) {
      const res = await apiFetch('/preferences/default-provider', {
        method: 'POST',
        body: JSON.stringify({ providerId }),
      });
      if (!res.ok) {
        const data = (await readJson(res)) as { error?: string };
        throw new Error(data.error ?? `Set default failed (${res.status})`);
      }
      emit({ type: 'preferences', defaultProviderId: providerId });
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
