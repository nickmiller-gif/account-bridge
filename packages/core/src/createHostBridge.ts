import { createAccountBridge } from './bridge.js';
import { deriveKeyFromSecret } from './crypto.js';
import { createHostBridgeClient } from './hostClient.js';
import type { HostBridgeConfig } from './hostConfig.js';
import { resolveHostProviders, scopeBridgeUserId } from './hostConfig.js';
import { localEncryptedStorage } from './storage/localEncrypted.js';
import type { AccountBridge, CredentialStore } from './types.js';

import type { EncryptionKeyMaterial } from './types.js';

export interface LocalAccountBridgeConfig {
  appId: string;
  userId?: string;
  includeMicrosoftCopilot?: boolean;
  includeCompatProviders?: boolean;
  providerIds?: HostBridgeConfig['providerIds'];
  getEncryptionKey: () => Promise<EncryptionKeyMaterial> | EncryptionKeyMaterial;
  storage?: CredentialStore;
  fetch?: typeof fetch;
}

/** Production browser apps — settings REST + gateway on the host origin. */
export function createBrowserHostBridge(config: HostBridgeConfig): AccountBridge {
  return createHostBridgeClient({
    baseUrl: config.baseUrl,
    getAuthHeaders: config.getAuthHeaders,
    apiPrefix: config.apiPrefix,
    oauthBasePath: config.oauthBasePath,
    gatewayPath: config.gatewayPath,
    providers: resolveHostProviders(config),
    fetch: config.fetch,
    _suppressDeprecationWarning: true,
    publishableKey: config.publishableKey,
  });
}

/** Local / demo — encrypted browser storage scoped by appId namespace. */
export function createLocalAccountBridge(config: LocalAccountBridgeConfig): AccountBridge {
  return createAccountBridge({
    appId: config.appId,
    userId: config.userId,
    storage: config.storage ?? localEncryptedStorage({ namespace: config.appId }),
    providers: resolveHostProviders(config),
    getEncryptionKey: config.getEncryptionKey,
    fetch: config.fetch,
  });
}

export { scopeBridgeUserId };
