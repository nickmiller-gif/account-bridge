import type { CredentialStore, ProviderId, ProviderStatus, StoredCredentialRecord, UserPreferences } from '../types.js';

interface MemoryEntry {
  record: StoredCredentialRecord;
}

export function memoryStorage(): CredentialStore {
  const store = new Map<string, MemoryEntry>();
  const preferences = new Map<string, UserPreferences>();

  function key(userId: string, providerId: ProviderId): string {
    return `${userId}::${providerId}`;
  }

  return {
    async get(userId, providerId) {
      return store.get(key(userId, providerId))?.record ?? null;
    },

    async set(userId, record) {
      store.set(key(userId, record.providerId), { record });
    },

    async delete(userId, providerId) {
      store.delete(key(userId, providerId));
    },

    async list(userId) {
      const statuses: ProviderStatus[] = [];
      for (const [k, entry] of store) {
        if (!k.startsWith(`${userId}::`)) continue;
        statuses.push({
          providerId: entry.record.providerId,
          connected: true,
          validatedAt: entry.record.validatedAt,
          label: entry.record.label,
          authKind: entry.record.authKind,
          defaultModel: entry.record.defaultModel,
        });
      }
      return statuses;
    },

    async getPreferences(userId) {
      return preferences.get(userId) ?? { defaultProviderId: null };
    },

    async setPreferences(userId, prefs) {
      preferences.set(userId, prefs);
    },
  };
}