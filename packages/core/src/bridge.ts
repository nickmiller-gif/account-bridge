import { decryptPayload, encodeJson, encryptPayload, decodeJson } from './crypto.js';
import {
  authKindOf,
  normalizeStoredCredential,
  resolveDefaultModel,
  type OAuthCredential,
  type StoredCredential,
} from './credentials.js';
import {
  FeatureLockedError,
  InvalidCredentialError,
  NotConnectedError,
  ProviderUnavailableError,
} from './errors.js';
import {
  refreshOAuthCredentialIfNeeded,
  type OAuthRefreshOptions,
} from './oauthRefresh.js';
import { createProviderRegistry } from './registry.js';
import type {
  AccountBridge,
  AccountBridgeOptions,
  AiProviderDefinition,
  BridgeChangeEvent,
  ChatClient,
  FundingStatus,
  ProviderId,
  ProviderStatus,
  UserPreferences,
} from './types.js';
import { scopeBridgeUserId } from './hostConfig.js';
import { consumerCreditsReady } from './consumerCredits.js';

const DEFAULT_USER_ID = 'default';

export function createAccountBridge(options: AccountBridgeOptions): AccountBridge {
  const userId = scopeBridgeUserId(options.appId, options.userId ?? DEFAULT_USER_ID);
  const fetchImpl = options.fetch ?? fetch;
  const oauthRefresh: OAuthRefreshOptions | undefined = options.oauthRefresh;
  const providerMap = new Map<ProviderId, AiProviderDefinition>(
    options.providers.map((p) => [p.id, p]),
  );
  const listeners = new Set<(event: BridgeChangeEvent) => void>();

  function emit(event: BridgeChangeEvent): void {
    for (const listener of listeners) listener(event);
  }

  function getProvider(providerId: ProviderId): AiProviderDefinition {
    const provider = providerMap.get(providerId);
    if (!provider) throw new ProviderUnavailableError(providerId);
    return provider;
  }

  async function getKey(): Promise<Uint8Array> {
    const material = await options.getEncryptionKey();
    return material.key;
  }

  async function persistCredential(
    providerId: ProviderId,
    normalized: StoredCredential,
  ): Promise<void> {
    const existing = await options.storage.get(userId, providerId);
    const keyMaterial = await getKey();
    const encryptedPayload = await encryptPayload(encodeJson(normalized), keyMaterial);
    await options.storage.set(userId, {
      providerId,
      encryptedPayload,
      validatedAt: new Date().toISOString(),
      authKind: authKindOf(normalized),
      defaultModel: existing?.defaultModel ?? resolveDefaultModel(normalized, ''),
    });
  }

  async function ensureFreshCredentials(providerId: ProviderId): Promise<StoredCredential> {
    const record = await options.storage.get(userId, providerId);
    if (!record) throw new NotConnectedError(providerId);

    let normalized = normalizeStoredCredential(
      decodeJson<unknown>(await decryptPayload(record.encryptedPayload, await getKey())),
    );

    if (normalized.kind === 'oauth' && oauthRefresh) {
      const provider = getProvider(providerId);
      try {
        const refreshed = await refreshOAuthCredentialIfNeeded(
          normalized as OAuthCredential,
          provider,
          oauthRefresh,
          fetchImpl,
        );
        if (refreshed.accessToken !== normalized.accessToken || refreshed.expiresAt !== normalized.expiresAt) {
          normalized = refreshed;
          await persistCredential(providerId, normalized);
          emit({ type: 'connect', providerId });
        }
      } catch (err) {
        throw new InvalidCredentialError(
          providerId,
          err instanceof Error ? err.message : 'OAuth refresh failed — reconnect in settings',
        );
      }
    }

    return normalized;
  }

  async function readPreferences(): Promise<UserPreferences> {
    if (options.storage.getPreferences) {
      const prefs = await options.storage.getPreferences(userId);
      return prefs ?? { defaultProviderId: null };
    }
    return { defaultProviderId: null };
  }

  async function resolveDefaultConnectedProvider(): Promise<ProviderId | null> {
    const prefs = await readPreferences();
    if (prefs.defaultProviderId && (await options.storage.get(userId, prefs.defaultProviderId))) {
      return prefs.defaultProviderId;
    }
    const connected = await options.storage.list(userId);
    const first = connected.find((c) => c.connected);
    return first?.providerId ?? null;
  }

  return {
    async connect(providerId, rawCredentials) {
      const provider = getProvider(providerId);
      const normalized = normalizeStoredCredential(rawCredentials);
      provider.credentialSchema.parse(normalized);
      const validation = await provider.validate(normalized, fetchImpl);
      if (!validation.ok) {
        throw new InvalidCredentialError(
          providerId,
          validation.message ?? 'Credential validation failed',
        );
      }
      await persistCredential(providerId, normalized);
      emit({ type: 'connect', providerId });
      return validation;
    },

    async disconnect(providerId) {
      getProvider(providerId);
      await options.storage.delete(userId, providerId);
      const prefs = await readPreferences();
      if (prefs.defaultProviderId === providerId) {
        await this.setDefaultProvider(null);
      }
      emit({ type: 'disconnect', providerId });
    },

    async has(providerId) {
      if (!providerMap.has(providerId)) return false;
      const record = await options.storage.get(userId, providerId);
      return record !== null;
    },

    async getClient(providerId) {
      const provider = getProvider(providerId);
      const credentials = await ensureFreshCredentials(providerId);
      return provider.createChatClient(credentials, fetchImpl) as ChatClient;
    },

    async resolveClient(providerId) {
      const resolvedId = providerId ?? (await resolveDefaultConnectedProvider());
      if (!resolvedId) {
        throw new FeatureLockedError('default');
      }
      const client = await this.getClient(resolvedId);
      return { client, providerId: resolvedId };
    },

    async validate(providerId) {
      const provider = getProvider(providerId);
      const credentials = await ensureFreshCredentials(providerId);
      return provider.validate(credentials, fetchImpl);
    },

    async listProviders() {
      const connected = await options.storage.list(userId);
      const connectedIds = new Set(connected.map((c) => c.providerId));
      const all: ProviderStatus[] = options.providers.map((p) => {
        const existing = connected.find((c) => c.providerId === p.id);
        if (existing) return existing;
        return { providerId: p.id, connected: false };
      });
      for (const id of connectedIds) {
        if (!all.some((s) => s.providerId === id)) {
          const row = connected.find((c) => c.providerId === id);
          if (row) all.push(row);
        }
      }
      return all;
    },

    getProviderDefinition(providerId) {
      return providerMap.get(providerId);
    },

    async getDefaultProvider() {
      return resolveDefaultConnectedProvider();
    },

    async setDefaultProvider(providerId) {
      if (providerId !== null) {
        getProvider(providerId);
        if (!(await this.has(providerId))) {
          throw new NotConnectedError(providerId);
        }
      }
      if (options.storage.setPreferences) {
        await options.storage.setPreferences(userId, { defaultProviderId: providerId });
      }
      emit({ type: 'preferences', defaultProviderId: providerId });
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    async getFundingStatus(): Promise<FundingStatus> {
      const connected = (await this.listProviders()).filter((p) => p.connected);
      const defaultProvider = await this.getDefaultProvider();
      const ready = await consumerCreditsReady(this);
      return {
        ready,
        fundingPolicy: { mode: 'byok' },
        connectedCount: connected.length,
        defaultProvider,
        walletEnabled: false,
      };
    },
  };
}

export { FeatureLockedError };

export async function requireProvider(
  bridge: AccountBridge,
  providerId: ProviderId,
): Promise<void> {
  const connected = await bridge.has(providerId);
  if (!connected) {
    throw new FeatureLockedError(providerId);
  }
}
