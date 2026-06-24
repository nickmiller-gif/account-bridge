import type { AiProviderDefinition, ProviderId } from './types.js';
import { createProviderRegistry } from './registry.js';

/** Default provider cards shown when host omits `providerIds`. */
export const DEFAULT_HOST_PROVIDER_IDS: ProviderId[] = ['openai', 'anthropic', 'gemini'];

export interface ResolveHostProvidersOptions {
  providerIds?: ProviderId[];
  includeMicrosoftCopilot?: boolean;
  includeCompatProviders?: boolean;
  extras?: AiProviderDefinition[];
  providers?: AiProviderDefinition[];
}

/** Shared config shape for browser + server host integration. */
export interface HostBridgeConfig extends ResolveHostProvidersOptions {
  /**
   * Unique slug per host product (e.g. `centralr2-core`, `r2works`, `tower-negotiator`).
   * Isolates encrypted credentials when multiple apps share storage or a DB.
   */
  appId: string;
  /** Public origin of the host app, e.g. https://myapp.com */
  baseUrl: string;
  /** Consumer session auth for settings API + gateway */
  getAuthHeaders: () => Promise<Record<string, string>> | Record<string, string>;
  /** Settings REST prefix (default `/account-bridge`) */
  apiPrefix?: string;
  /** OAuth mount prefix (default `{apiPrefix}/oauth`) */
  oauthBasePath?: string;
  /** OpenAI-compatible gateway path (default `/v1/chat/completions`) */
  gatewayPath?: string;
  fetch?: typeof fetch;
  /** Platform SaaS publishable key (`ab_pk_…`) — safe for browser embeds */
  publishableKey?: string;
}

export interface ServerHostBridgeConfig extends HostBridgeConfig {
  /** Server-side encryption secret — never expose to browser */
  encryptionSecret: string;
  /** Consumer funding policy for this app (default: byok) */
  fundingPolicy?: import('./types.js').FundingPolicy;
}

export function scopeBridgeUserId(appId: string | undefined, userId: string): string {
  return appId ? `${appId}:${userId}` : userId;
}

export function defaultOAuthBasePath(apiPrefix = '/account-bridge'): string {
  return `${apiPrefix.replace(/\/$/, '')}/oauth`;
}

export function buildOAuthStartUrl(oauthProviderKey: string, oauthBasePath?: string, apiPrefix?: string): string {
  const base = oauthBasePath ?? defaultOAuthBasePath(apiPrefix);
  return `${base.replace(/\/$/, '')}/${oauthProviderKey}/start`;
}

export function resolveHostProviders(options: ResolveHostProvidersOptions = {}): AiProviderDefinition[] {
  if (options.providers?.length) {
    return options.providers;
  }

  const registry = createProviderRegistry({
    extras: options.extras,
    includeMicrosoftCopilot: options.includeMicrosoftCopilot ?? false,
    includeCompatProviders: options.includeCompatProviders ?? true,
  });

  const ids = options.providerIds ?? DEFAULT_HOST_PROVIDER_IDS;
  return ids
    .map((id) => registry.get(id))
    .filter((p): p is AiProviderDefinition => p !== undefined);
}

export function resolveHostProviderIds(options: ResolveHostProvidersOptions = {}): ProviderId[] {
  return resolveHostProviders(options).map((p) => p.id);
}
