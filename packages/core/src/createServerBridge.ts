import { createAccountBridge } from './bridge.js';
import { deriveKeyFromSecret } from './crypto.js';
import type { OAuthRefreshOptions } from './oauthRefresh.js';
import type { ServerHostBridgeConfig } from './hostConfig.js';
import { resolveHostProviders } from './hostConfig.js';
import { fileEncryptedStorage } from './storage/file.js';
import { memoryStorage } from './storage/memory.js';
import type { AccountBridge, CredentialStore } from './types.js';

export interface ServerBridgeFactoryOptions extends ServerHostBridgeConfig {
  storage?: CredentialStore;
  storageKind?: 'file' | 'memory';
  /** Google OAuth client — enables token refresh for Gemini */
  googleOAuth?: { clientId: string; clientSecret: string };
  /** Microsoft OAuth client — enables token refresh for Copilot */
  microsoftOAuth?: { clientId: string; clientSecret: string; tenantId?: string };
  oauthSkewSeconds?: number;
}

function buildOAuthRefresh(options: ServerBridgeFactoryOptions): OAuthRefreshOptions | undefined {
  if (!options.googleOAuth && !options.microsoftOAuth) return undefined;
  return {
    google: options.googleOAuth,
    microsoft: options.microsoftOAuth,
    skewSeconds: options.oauthSkewSeconds,
  };
}

/** Trusted server — one factory per request user id. Import from `@account-bridge/core/node`. */
export function createServerBridgeFactory(
  config: ServerBridgeFactoryOptions,
): (userId: string) => AccountBridge {
  const providers = resolveHostProviders(config);
  const oauthRefresh = buildOAuthRefresh(config);
  const storage =
    config.storage ??
    (config.storageKind === 'memory'
      ? memoryStorage()
      : fileEncryptedStorage({ namespace: config.appId }));

  return (userId: string) =>
    createAccountBridge({
      appId: config.appId,
      userId,
      storage,
      providers,
      getEncryptionKey: async () => ({
        key: await deriveKeyFromSecret(config.encryptionSecret, `${config.appId}:v1`),
      }),
      fetch: config.fetch,
      oauthRefresh,
    });
}
