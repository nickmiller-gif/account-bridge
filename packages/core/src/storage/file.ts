import { mkdir, readFile, writeFile, unlink, readdir, chmod } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { decryptPayload, encryptPayload, decodeJson, encodeJson } from '../crypto.js';
import { StorageError } from '../errors.js';
import type {
  CredentialStore,
  EncryptionKeyMaterial,
  FileEncryptedStorageOptions,
  ProviderId,
  ProviderStatus,
  StoredCredentialRecord,
  UserPreferences,
} from '../types.js';

interface FileRecord {
  providerId: ProviderId;
  encryptedPayload: number[];
  validatedAt: string;
  label?: string;
}

export function fileEncryptedStorage(options: FileEncryptedStorageOptions): CredentialStore {
  const directory = options.directory ?? join(homedir(), '.account-bridge', options.namespace);

  async function ensureDir(): Promise<void> {
    await mkdir(directory, { recursive: true, mode: 0o700 });
  }

  function filePath(userId: string, providerId: ProviderId): string {
    const safeUser = encodeURIComponent(userId);
    return join(directory, `${safeUser}__${providerId}.json`);
  }

  async function readRecord(userId: string, providerId: ProviderId): Promise<StoredCredentialRecord | null> {
    try {
      const raw = await readFile(filePath(userId, providerId), 'utf8');
      const parsed = JSON.parse(raw) as FileRecord;
      return {
        providerId: parsed.providerId,
        encryptedPayload: new Uint8Array(parsed.encryptedPayload),
        validatedAt: parsed.validatedAt,
        label: parsed.label,
      };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw new StorageError(`Failed to read credential file: ${(err as Error).message}`);
    }
  }

  function prefsPath(userId: string): string {
    return join(directory, `${encodeURIComponent(userId)}__preferences.json`);
  }

  async function readPreferences(userId: string): Promise<UserPreferences> {
    try {
      const raw = await readFile(prefsPath(userId), 'utf8');
      return JSON.parse(raw) as UserPreferences;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return { defaultProviderId: null };
      }
      throw new StorageError(`Failed to read preferences: ${(err as Error).message}`);
    }
  }

  return {
    async get(userId, providerId) {
      return readRecord(userId, providerId);
    },

    async set(userId, record) {
      await ensureDir();
      const payload: FileRecord = {
        providerId: record.providerId,
        encryptedPayload: Array.from(record.encryptedPayload),
        validatedAt: record.validatedAt,
        label: record.label,
      };
      const path = filePath(userId, record.providerId);
      await writeFile(path, JSON.stringify(payload), { mode: 0o600 });
      await chmod(path, 0o600);
    },

    async delete(userId, providerId) {
      try {
        await unlink(filePath(userId, providerId));
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
          throw new StorageError(`Failed to delete credential file: ${(err as Error).message}`);
        }
      }
    },

    async list(userId) {
      await ensureDir();
      const statuses: ProviderStatus[] = [];
      const safePrefix = `${encodeURIComponent(userId)}__`;
      let files: string[];
      try {
        files = await readdir(directory);
      } catch {
        return statuses;
      }
      for (const file of files) {
        if (!file.startsWith(safePrefix) || !file.endsWith('.json')) continue;
        if (file.endsWith('__preferences.json')) continue;
        const providerId = file.slice(safePrefix.length, -'.json'.length) as ProviderId;
        const record = await readRecord(userId, providerId);
        if (!record) continue;
        statuses.push({
          providerId: record.providerId,
          connected: true,
          validatedAt: record.validatedAt,
          label: record.label,
        });
      }
      return statuses;
    },

    async getPreferences(userId) {
      return readPreferences(userId);
    },

    async setPreferences(userId, prefs) {
      await ensureDir();
      const path = prefsPath(userId);
      await writeFile(path, JSON.stringify(prefs), { mode: 0o600 });
      await chmod(path, 0o600);
    },
  };
}

export async function encryptCredentials<T>(
  credentials: T,
  getEncryptionKey: () => Promise<EncryptionKeyMaterial> | EncryptionKeyMaterial,
): Promise<Uint8Array> {
  const { key } = await getEncryptionKey();
  return encryptPayload(encodeJson(credentials), key);
}

export async function decryptCredentials<T>(
  encrypted: Uint8Array,
  getEncryptionKey: () => Promise<EncryptionKeyMaterial> | EncryptionKeyMaterial,
): Promise<T> {
  const { key } = await getEncryptionKey();
  const plaintext = await decryptPayload(encrypted, key);
  return decodeJson<T>(plaintext);
}
