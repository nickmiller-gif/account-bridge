import type {
  CredentialStore,
  ProviderId,
  ProviderStatus,
  StoredCredentialRecord,
  UserPreferences,
} from '@account-bridge/core';

export interface QueryExecutor {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

export interface SqlCredentialStoreOptions {
  /** Postgres pool or custom query executor */
  query: QueryExecutor['query'];
  /** Table prefix (default account_bridge) */
  tablePrefix?: string;
}

export const SQL_MIGRATION = `
CREATE TABLE IF NOT EXISTS account_bridge_credentials (
  user_id text NOT NULL,
  provider_id text NOT NULL,
  encrypted_payload bytea NOT NULL,
  auth_kind text NOT NULL DEFAULT 'api_key',
  validated_at timestamptz NOT NULL DEFAULT now(),
  default_model text,
  label text,
  PRIMARY KEY (user_id, provider_id)
);

CREATE TABLE IF NOT EXISTS account_bridge_preferences (
  user_id text PRIMARY KEY,
  default_provider_id text
);
`;

export function sqlCredentialStore(options: SqlCredentialStoreOptions): CredentialStore {
  const prefix = options.tablePrefix ?? 'account_bridge';
  const credTable = `${prefix}_credentials`;
  const prefTable = `${prefix}_preferences`;
  const query = options.query;

  return {
    async get(userId, providerId) {
      const { rows } = await query<{
        provider_id: string;
        encrypted_payload: Buffer;
        validated_at: string;
        auth_kind: string;
        default_model: string | null;
        label: string | null;
      }>(
        `SELECT provider_id, encrypted_payload, validated_at, auth_kind, default_model, label
         FROM ${credTable} WHERE user_id = $1 AND provider_id = $2`,
        [userId, providerId],
      );
      const row = rows[0];
      if (!row) return null;
      return {
        providerId: row.provider_id,
        encryptedPayload: new Uint8Array(row.encrypted_payload),
        validatedAt: row.validated_at,
        authKind: row.auth_kind as StoredCredentialRecord['authKind'],
        defaultModel: row.default_model ?? undefined,
        label: row.label ?? undefined,
      };
    },

    async set(userId, record) {
      await query(
        `INSERT INTO ${credTable} (user_id, provider_id, encrypted_payload, auth_kind, validated_at, default_model, label)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (user_id, provider_id) DO UPDATE SET
           encrypted_payload = EXCLUDED.encrypted_payload,
           auth_kind = EXCLUDED.auth_kind,
           validated_at = EXCLUDED.validated_at,
           default_model = EXCLUDED.default_model,
           label = EXCLUDED.label`,
        [
          userId,
          record.providerId,
          Buffer.from(record.encryptedPayload),
          record.authKind ?? 'api_key',
          record.validatedAt,
          record.defaultModel ?? null,
          record.label ?? null,
        ],
      );
    },

    async delete(userId, providerId) {
      await query(`DELETE FROM ${credTable} WHERE user_id = $1 AND provider_id = $2`, [
        userId,
        providerId,
      ]);
    },

    async list(userId) {
      const { rows } = await query<{
        provider_id: string;
        validated_at: string;
        auth_kind: string;
        default_model: string | null;
        label: string | null;
      }>(
        `SELECT provider_id, validated_at, auth_kind, default_model, label FROM ${credTable} WHERE user_id = $1`,
        [userId],
      );
      return rows.map(
        (row): ProviderStatus => ({
          providerId: row.provider_id,
          connected: true,
          validatedAt: row.validated_at,
          authKind: row.auth_kind as ProviderStatus['authKind'],
          defaultModel: row.default_model ?? undefined,
          label: row.label ?? undefined,
        }),
      );
    },

    async getPreferences(userId) {
      const { rows } = await query<{ default_provider_id: string | null }>(
        `SELECT default_provider_id FROM ${prefTable} WHERE user_id = $1`,
        [userId],
      );
      const row = rows[0];
      return { defaultProviderId: row?.default_provider_id ?? null };
    },

    async setPreferences(userId, preferences: UserPreferences) {
      await query(
        `INSERT INTO ${prefTable} (user_id, default_provider_id)
         VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET default_provider_id = EXCLUDED.default_provider_id`,
        [userId, preferences.defaultProviderId],
      );
    },
  };
}
