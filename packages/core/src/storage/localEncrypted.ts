import { decryptPayload, encryptPayload, decodeJson, encodeJson } from '../crypto.js';
import { StorageError } from '../errors.js';
import type {
  CredentialStore,
  EncryptionKeyMaterial,
  LocalEncryptedStorageOptions,
  ProviderId,
  ProviderStatus,
  StoredCredentialRecord,
  UserPreferences,
} from '../types.js';

const DB_VERSION = 2;
const STORE_NAME = 'credentials';
const PREFS_STORE = 'preferences';

interface IdRecord {
  userId: string;
  providerId: ProviderId;
}

interface DbRecord extends IdRecord {
  encryptedPayload: Uint8Array;
  validatedAt: string;
  label?: string;
}

interface PrefsRecord {
  userId: string;
  defaultProviderId: ProviderId | null;
}

export function localEncryptedStorage(options: LocalEncryptedStorageOptions): CredentialStore {
  const dbName = options.dbName ?? `account-bridge-${options.namespace}`;

  function openDb(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new StorageError('IndexedDB is not available in this environment'));
        return;
      }
      const request = indexedDB.open(dbName, DB_VERSION);
      request.onerror = () => reject(new StorageError('Failed to open IndexedDB'));
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: ['userId', 'providerId'] });
          store.createIndex('byUser', 'userId', { unique: false });
        }
        if (!db.objectStoreNames.contains(PREFS_STORE)) {
          db.createObjectStore(PREFS_STORE, { keyPath: 'userId' });
        }
      };
    });
  }

  async function withStore<T>(
    mode: IDBTransactionMode,
    fn: (store: IDBObjectStore) => IDBRequest<T> | Promise<T>,
  ): Promise<T> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, mode);
      const store = tx.objectStore(STORE_NAME);
      Promise.resolve(fn(store))
        .then((result) => {
          if (result instanceof IDBRequest) {
            result.onsuccess = () => resolve(result.result as T);
            result.onerror = () => reject(new StorageError('IndexedDB operation failed'));
          } else {
            tx.oncomplete = () => resolve(result);
            tx.onerror = () => reject(new StorageError('IndexedDB transaction failed'));
          }
        })
        .catch(reject);
    });
  }

  async function withPrefsStore<T>(
    mode: IDBTransactionMode,
    fn: (store: IDBObjectStore) => IDBRequest<T> | Promise<T>,
  ): Promise<T> {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(PREFS_STORE, mode);
      const store = tx.objectStore(PREFS_STORE);
      Promise.resolve(fn(store))
        .then((result) => {
          if (result instanceof IDBRequest) {
            result.onsuccess = () => resolve(result.result as T);
            result.onerror = () => reject(new StorageError('IndexedDB preferences failed'));
          } else {
            tx.oncomplete = () => resolve(result);
            tx.onerror = () => reject(new StorageError('IndexedDB preferences transaction failed'));
          }
        })
        .catch(reject);
    });
  }

  return {
    async get(userId, providerId) {
      const row = await withStore<DbRecord | undefined>('readonly', (store) => {
        return store.get([userId, providerId]);
      });
      if (!row) return null;
      return {
        providerId: row.providerId,
        encryptedPayload: row.encryptedPayload,
        validatedAt: row.validatedAt,
        label: row.label,
      };
    },

    async set(userId, record) {
      await withStore('readwrite', (store) => {
        store.put({
          userId,
          providerId: record.providerId,
          encryptedPayload: record.encryptedPayload,
          validatedAt: record.validatedAt,
          label: record.label,
        } satisfies DbRecord);
        return Promise.resolve(undefined);
      });
    },

    async delete(userId, providerId) {
      await withStore('readwrite', (store) => {
        store.delete([userId, providerId]);
        return Promise.resolve(undefined);
      });
    },

    async list(userId) {
      const rows = await withStore<DbRecord[]>('readonly', (store) => {
        const index = store.index('byUser');
        return index.getAll(userId);
      });
      return rows.map(
        (row): ProviderStatus => ({
          providerId: row.providerId,
          connected: true,
          validatedAt: row.validatedAt,
          label: row.label,
        }),
      );
    },

    async getPreferences(userId) {
      try {
        const row = await withPrefsStore<PrefsRecord | undefined>('readonly', (store) => store.get(userId));
        return row ? { defaultProviderId: row.defaultProviderId } : { defaultProviderId: null };
      } catch {
        return { defaultProviderId: null };
      }
    },

    async setPreferences(userId, prefs: UserPreferences) {
      await withPrefsStore('readwrite', (store) => {
        store.put({ userId, defaultProviderId: prefs.defaultProviderId } satisfies PrefsRecord);
        return Promise.resolve(undefined);
      });
    },
  };
}


export async function encryptCredentialsBrowser<T>(
  credentials: T,
  getEncryptionKey: () => Promise<EncryptionKeyMaterial> | EncryptionKeyMaterial,
): Promise<Uint8Array> {
  const { key } = await getEncryptionKey();
  return encryptPayload(encodeJson(credentials), key);
}

export async function decryptCredentialsBrowser<T>(
  encrypted: Uint8Array,
  getEncryptionKey: () => Promise<EncryptionKeyMaterial> | EncryptionKeyMaterial,
): Promise<T> {
  const { key } = await getEncryptionKey();
  const plaintext = await decryptPayload(encrypted, key);
  return decodeJson<T>(plaintext);
}
