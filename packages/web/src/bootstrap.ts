import type { AccountBridge, FundingPolicy, ProviderId } from '@account-bridge/core';
import {
  buildOAuthStartUrl,
  createBrowserHostBridge,
  createLocalAccountBridge,
  DEFAULT_HOST_PROVIDER_IDS,
  deriveKeyFromSecret,
} from '@account-bridge/core';

import type { AccountBridgeEmbedConfig, AuthHeadersRequestDetail } from './types.js';

function parseBool(value: string | null | undefined): boolean {
  return value === 'true' || value === '1' || value === '';
}

function parseProviderIds(raw: string | null): ProviderId[] | undefined {
  if (!raw?.trim()) return undefined;
  return raw.split(',').map((s) => s.trim()) as ProviderId[];
}

function parseFundingPolicy(el: HTMLElement): FundingPolicy | undefined {
  const mode = el.getAttribute('funding-mode');
  if (!mode || !['byok', 'wallet', 'auto'].includes(mode)) return undefined;
  const walletEnabled = parseBool(el.getAttribute('wallet-enabled'));
  return {
    mode: mode as FundingPolicy['mode'],
    wallet: walletEnabled ? { enabled: true } : undefined,
  };
}

export function configFromElement(el: HTMLElement): AccountBridgeEmbedConfig {
  return {
    appId: el.getAttribute('app-id') ?? 'default-app',
    transport: (el.getAttribute('transport') as 'local' | 'remote') ?? 'local',
    baseUrl: el.getAttribute('base-url') ?? undefined,
    apiPrefix: el.getAttribute('api-prefix') ?? undefined,
    oauthBasePath: el.getAttribute('oauth-base-path') ?? undefined,
    gatewayPath: el.getAttribute('gateway-path') ?? undefined,
    providerIds: parseProviderIds(el.getAttribute('provider-ids')),
    includeMicrosoftCopilot: parseBool(el.getAttribute('include-microsoft-copilot')),
    includeCompatProviders: parseBool(el.getAttribute('include-compat-providers')),
    mode: (el.getAttribute('mode') as AccountBridgeEmbedConfig['mode']) || undefined,
    theme: (el.getAttribute('theme') as AccountBridgeEmbedConfig['theme']) ?? 'dark',
    compact: parseBool(el.getAttribute('compact')),
    userId: el.getAttribute('user-id') ?? undefined,
    localPassphrase: el.getAttribute('local-passphrase') ?? undefined,
    copilotProviderId: (el.getAttribute('copilot-provider-id') as ProviderId) ?? undefined,
    copilotTitle: el.getAttribute('copilot-title') ?? undefined,
    copilotSubtitle: el.getAttribute('copilot-subtitle') ?? undefined,
    fundingPolicy: parseFundingPolicy(el),
    authToken: el.getAttribute('auth-token') ?? undefined,
    authHeaderName: el.getAttribute('auth-header-name') ?? undefined,
  };
}

export async function resolveAuthHeaders(
  el: HTMLElement,
  config: AccountBridgeEmbedConfig,
): Promise<Record<string, string>> {
  if (config.authToken) {
    const headerName = config.authHeaderName ?? 'Authorization';
    const value =
      headerName.toLowerCase() === 'authorization' && !config.authToken.startsWith('Bearer ')
        ? `Bearer ${config.authToken}`
        : config.authToken;
    return { [headerName]: value };
  }

  return new Promise((resolve) => {
    const detail: AuthHeadersRequestDetail = {
      callback: (headers) => resolve(headers),
    };
    const handled = el.dispatchEvent(
      new CustomEvent('auth-callback', { detail, cancelable: true }),
    );
    if (!handled) {
      resolve({});
    }
    setTimeout(() => resolve({}), 50);
  });
}

export function createBridgeFromConfig(
  config: AccountBridgeEmbedConfig,
  getAuthHeaders: () => Promise<Record<string, string>>,
): AccountBridge {
  const providerOptions = {
    providerIds: config.providerIds ?? DEFAULT_HOST_PROVIDER_IDS,
    includeMicrosoftCopilot: config.includeMicrosoftCopilot ?? false,
    includeCompatProviders: config.includeCompatProviders ?? false,
  };

  if (config.transport === 'remote') {
    if (!config.baseUrl) {
      throw new Error('account-bridge: remote transport requires base-url attribute');
    }
    return createBrowserHostBridge({
      appId: config.appId,
      baseUrl: config.baseUrl,
      getAuthHeaders,
      apiPrefix: config.apiPrefix,
      oauthBasePath: config.oauthBasePath,
      gatewayPath: config.gatewayPath,
      ...providerOptions,
    });
  }

  const pass = config.localPassphrase ?? config.appId;
  return createLocalAccountBridge({
    appId: config.appId,
    userId: config.userId ?? 'default',
    ...providerOptions,
    getEncryptionKey: async () => ({
      key: await deriveKeyFromSecret(pass, `${config.appId}:v1`),
    }),
  });
}

export function oauthStartUrlFor(
  config: AccountBridgeEmbedConfig,
  oauthProviderKey: string,
): string {
  return buildOAuthStartUrl(oauthProviderKey, config.oauthBasePath, config.apiPrefix);
}
