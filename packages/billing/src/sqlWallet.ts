import { ConsumerFundingRequiredError } from '@account-bridge/core';
import type {
  LedgerEntry,
  WalletBalance,
  WalletCreditParams,
  WalletDebitParams,
  WalletStore,
} from '@account-bridge/core';

import { estimateUsageMicrocredits } from './pricing.js';

export interface QueryExecutor {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  /** When available, wraps debit/credit in a single transaction */
  transaction?<T>(fn: (tx: QueryExecutor) => Promise<T>): Promise<T>;
}

export interface SqlWalletStoreOptions {
  query: QueryExecutor['query'];
  transaction?: QueryExecutor['transaction'];
  tablePrefix?: string;
}

export const WALLET_SQL_MIGRATION = `
CREATE TABLE IF NOT EXISTS account_bridge_wallets (
  user_id text NOT NULL,
  app_id text NOT NULL,
  balance_microcredits bigint NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'usd',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, app_id)
);

CREATE TABLE IF NOT EXISTS account_bridge_ledger (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  app_id text NOT NULL,
  delta_microcredits bigint NOT NULL,
  reason text NOT NULL,
  usage_json jsonb,
  idempotency_key text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS account_bridge_ledger_user_app_idx
  ON account_bridge_ledger (user_id, app_id, created_at DESC);

CREATE TABLE IF NOT EXISTS account_bridge_pricing (
  app_id text NOT NULL,
  provider_id text NOT NULL,
  model text NOT NULL DEFAULT '*',
  input_per_1k bigint NOT NULL DEFAULT 50,
  output_per_1k bigint NOT NULL DEFAULT 150,
  min_per_request bigint NOT NULL DEFAULT 100,
  PRIMARY KEY (app_id, provider_id, model)
);
`;

function newLedgerId(): string {
  return `led_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

async function withTransaction<T>(
  query: QueryExecutor['query'],
  transaction: QueryExecutor['transaction'] | undefined,
  fn: (q: QueryExecutor['query']) => Promise<T>,
): Promise<T> {
  if (transaction) {
    return transaction((tx) => fn(tx.query.bind(tx)));
  }
  await query('BEGIN');
  try {
    const result = await fn(query);
    await query('COMMIT');
    return result;
  } catch (err) {
    await query('ROLLBACK').catch(() => undefined);
    throw err;
  }
}

export function sqlWalletStore(options: SqlWalletStoreOptions): WalletStore {
  const prefix = options.tablePrefix ?? 'account_bridge';
  const wallets = `${prefix}_wallets`;
  const ledgerTable = `${prefix}_ledger`;
  const query = options.query;

  async function ensureWallet(userId: string, appId: string): Promise<void> {
    await query(
      `INSERT INTO ${wallets} (user_id, app_id, balance_microcredits)
       VALUES ($1, $2, 0)
       ON CONFLICT (user_id, app_id) DO NOTHING`,
      [userId, appId],
    );
  }

  return {
    async getBalance(userId, appId) {
      await ensureWallet(userId, appId);
      const { rows } = await query<{ balance_microcredits: string; currency: string }>(
        `SELECT balance_microcredits, currency FROM ${wallets} WHERE user_id = $1 AND app_id = $2`,
        [userId, appId],
      );
      const row = rows[0];
      return {
        balanceMicrocredits: Number(row?.balance_microcredits ?? 0),
        currency: row?.currency ?? 'usd',
      };
    },

    async assertSufficientBalance(userId, appId, estimatedMicrocredits) {
      const { balanceMicrocredits } = await this.getBalance(userId, appId);
      if (balanceMicrocredits < estimatedMicrocredits) {
        throw new ConsumerFundingRequiredError('Insufficient app credits.');
      }
    },

    async debit(params: WalletDebitParams) {
      if (params.idempotencyKey) {
        const { rows } = await query<{
          id: string;
          user_id: string;
          app_id: string;
          delta_microcredits: string;
          reason: string;
          usage_json: unknown;
          idempotency_key: string;
          created_at: string;
        }>(
          `SELECT * FROM ${ledgerTable} WHERE idempotency_key = $1`,
          [params.idempotencyKey],
        );
        const existing = rows[0];
        if (existing) {
          return {
            id: existing.id,
            userId: existing.user_id,
            appId: existing.app_id,
            deltaMicrocredits: Number(existing.delta_microcredits),
            reason: existing.reason,
            usage: existing.usage_json as LedgerEntry['usage'],
            idempotencyKey: existing.idempotency_key,
            createdAt: existing.created_at,
          };
        }
      }

      const cost = estimateUsageMicrocredits(params.usage, params.pricing);
      await ensureWallet(params.userId, params.appId);

      return withTransaction(query, options.transaction, async (q) => {
        const { rows: walletRows } = await q<{ balance_microcredits: string }>(
          `SELECT balance_microcredits FROM ${wallets}
           WHERE user_id = $1 AND app_id = $2 FOR UPDATE`,
          [params.userId, params.appId],
        );
        const balance = Number(walletRows[0]?.balance_microcredits ?? 0);
        if (balance < cost) {
          throw new ConsumerFundingRequiredError('Insufficient app credits.');
        }

        const id = newLedgerId();
        await q(
          `UPDATE ${wallets} SET balance_microcredits = balance_microcredits - $3, updated_at = now()
           WHERE user_id = $1 AND app_id = $2`,
          [params.userId, params.appId, cost],
        );
        await q(
          `INSERT INTO ${ledgerTable}
           (id, user_id, app_id, delta_microcredits, reason, usage_json, idempotency_key)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            id,
            params.userId,
            params.appId,
            -cost,
            'usage',
            JSON.stringify(params.usage),
            params.idempotencyKey,
          ],
        );

        return {
          id,
          userId: params.userId,
          appId: params.appId,
          deltaMicrocredits: -cost,
          reason: 'usage',
          usage: params.usage,
          idempotencyKey: params.idempotencyKey,
          createdAt: new Date().toISOString(),
        };
      });
    },

    async credit(params: WalletCreditParams) {
      if (params.idempotencyKey) {
        const { rows } = await query<{
          id: string;
          user_id: string;
          app_id: string;
          delta_microcredits: string;
          reason: string;
          idempotency_key: string;
          created_at: string;
        }>(
          `SELECT * FROM ${ledgerTable} WHERE idempotency_key = $1`,
          [params.idempotencyKey],
        );
        const existing = rows[0];
        if (existing) {
          return {
            id: existing.id,
            userId: existing.user_id,
            appId: existing.app_id,
            deltaMicrocredits: Number(existing.delta_microcredits),
            reason: existing.reason,
            idempotencyKey: existing.idempotency_key,
            createdAt: existing.created_at,
          };
        }
      }

      await ensureWallet(params.userId, params.appId);
      const id = newLedgerId();

      return withTransaction(query, options.transaction, async (q) => {
        await q(
          `UPDATE ${wallets} SET balance_microcredits = balance_microcredits + $3, updated_at = now()
           WHERE user_id = $1 AND app_id = $2`,
          [params.userId, params.appId, params.deltaMicrocredits],
        );
        await q(
          `INSERT INTO ${ledgerTable}
           (id, user_id, app_id, delta_microcredits, reason, idempotency_key)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [id, params.userId, params.appId, params.deltaMicrocredits, params.reason, params.idempotencyKey],
        );

        return {
          id,
          userId: params.userId,
          appId: params.appId,
          deltaMicrocredits: params.deltaMicrocredits,
          reason: params.reason,
          idempotencyKey: params.idempotencyKey,
          createdAt: new Date().toISOString(),
        };
      });
    },

    async listLedger(userId, appId, limit = 20) {
      const { rows } = await query<{
        id: string;
        user_id: string;
        app_id: string;
        delta_microcredits: string;
        reason: string;
        usage_json: unknown;
        idempotency_key: string | null;
        created_at: string;
      }>(
        `SELECT * FROM ${ledgerTable}
         WHERE user_id = $1 AND app_id = $2
         ORDER BY created_at DESC LIMIT $3`,
        [userId, appId, limit],
      );
      return rows.map((row) => ({
        id: row.id,
        userId: row.user_id,
        appId: row.app_id,
        deltaMicrocredits: Number(row.delta_microcredits),
        reason: row.reason,
        usage: row.usage_json as LedgerEntry['usage'],
        idempotencyKey: row.idempotency_key ?? undefined,
        createdAt: row.created_at,
      }));
    },
  };
}

/** Load per-app pricing overrides from `account_bridge_pricing` (optional host table). */
export async function loadSqlWalletPricing(
  options: Pick<SqlWalletStoreOptions, 'query' | 'tablePrefix'>,
  appId: string,
  providerId: string,
  model = '*',
): Promise<import('@account-bridge/core').WalletPricing | undefined> {
  const prefix = options.tablePrefix ?? 'account_bridge';
  const pricingTable = `${prefix}_pricing`;
  const { rows } = await options.query<{
    input_per_1k: string;
    output_per_1k: string;
    min_per_request: string;
  }>(
    `SELECT input_per_1k, output_per_1k, min_per_request
     FROM ${pricingTable}
     WHERE app_id = $1 AND provider_id = $2 AND model IN ($3, '*')
     ORDER BY CASE WHEN model = $3 THEN 0 ELSE 1 END
     LIMIT 1`,
    [appId, providerId, model],
  );
  const row = rows[0];
  if (!row) return undefined;
  return {
    inputPer1kTokens: Number(row.input_per_1k),
    outputPer1kTokens: Number(row.output_per_1k),
    minPerRequest: Number(row.min_per_request),
  };
}
