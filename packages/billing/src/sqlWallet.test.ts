import { describe, expect, it } from 'vitest';

import { ConsumerFundingRequiredError } from '@account-bridge/core';

import { sqlWalletStore, loadSqlWalletPricing, type QueryExecutor } from './sqlWallet.js';

type Row = Record<string, string | null>;

function createMockSqlWallet() {
  const wallets = new Map<string, number>();
  const ledgerByIdempotency = new Map<string, Row>();
  const pricing = new Map<string, Row>();

  const key = (userId: string, appId: string) => `${userId}:${appId}`;

  const query = (async (sql, params = []) => {
    const s = sql.replace(/\s+/g, ' ').trim();

    if (s === 'BEGIN' || s === 'COMMIT' || s === 'ROLLBACK') {
      return { rows: [] };
    }

    if (s.includes('INSERT INTO account_bridge_wallets') && s.includes('ON CONFLICT')) {
      const [userId, appId] = params as string[];
      if (!wallets.has(key(userId, appId))) wallets.set(key(userId, appId), 0);
      return { rows: [] };
    }

    if (s.includes('SELECT balance_microcredits') && s.includes('FROM account_bridge_wallets')) {
      const [userId, appId] = params as string[];
      const balance = wallets.get(key(userId, appId)) ?? 0;
      return { rows: [{ balance_microcredits: String(balance), currency: 'usd' }] };
    }

    if (s.includes('SELECT * FROM account_bridge_ledger WHERE idempotency_key')) {
      const idem = params[0] as string;
      const row = ledgerByIdempotency.get(idem);
      return { rows: row ? [row] : [] };
    }

    if (s.includes('UPDATE account_bridge_wallets SET balance_microcredits = balance_microcredits -')) {
      const [userId, appId, cost] = params as [string, string, number];
      const k = key(userId, appId);
      wallets.set(k, (wallets.get(k) ?? 0) - Number(cost));
      return { rows: [] };
    }

    if (s.includes('UPDATE account_bridge_wallets SET balance_microcredits = balance_microcredits +')) {
      const [userId, appId, delta] = params as [string, string, number];
      const k = key(userId, appId);
      wallets.set(k, (wallets.get(k) ?? 0) + Number(delta));
      return { rows: [] };
    }

    if (s.includes('INSERT INTO account_bridge_ledger')) {
      const [id, userId, appId, delta, reason, usageJson, idempotencyKey] = params as [
        string,
        string,
        string,
        number,
        string,
        string | null,
        string | null,
      ];
      const row: Row = {
        id,
        user_id: userId,
        app_id: appId,
        delta_microcredits: String(delta),
        reason,
        usage_json: usageJson,
        idempotency_key: idempotencyKey,
        created_at: new Date().toISOString(),
      };
      if (idempotencyKey) ledgerByIdempotency.set(idempotencyKey, row);
      return { rows: [] };
    }

    if (s.includes('FROM account_bridge_pricing')) {
      const [appId, providerId, model] = params as string[];
      const row =
        pricing.get(`${appId}:${providerId}:${model}`) ??
        pricing.get(`${appId}:${providerId}:*`);
      return { rows: row ? [row] : [] };
    }

    if (s.includes('ORDER BY created_at DESC')) {
      return { rows: [] };
    }

    throw new Error(`Unhandled SQL in mock: ${s}`);
  }) as QueryExecutor['query'];

  return {
    wallet: sqlWalletStore({ query }),
    seed(userId: string, appId: string, balance: number) {
      wallets.set(key(userId, appId), balance);
    },
    setPricing(appId: string, providerId: string, model: string, rates: Row) {
      pricing.set(`${appId}:${providerId}:${model}`, rates);
    },
    query,
  };
}

describe('sqlWalletStore', () => {
  it('debits balance atomically', async () => {
    const mock = createMockSqlWallet();
    mock.seed('u1', 'app1', 10_000);

    await mock.wallet.debit({
      userId: 'u1',
      appId: 'app1',
      usage: { inputTokens: 100, outputTokens: 50, providerId: 'openai' },
      idempotencyKey: 'idem-1',
    });

    const bal = await mock.wallet.getBalance('u1', 'app1');
    expect(bal.balanceMicrocredits).toBeLessThan(10_000);
  });

  it('idempotent debit returns same ledger entry', async () => {
    const mock = createMockSqlWallet();
    mock.seed('u1', 'app1', 10_000);

    const first = await mock.wallet.debit({
      userId: 'u1',
      appId: 'app1',
      usage: { inputTokens: 10, providerId: 'openai' },
      idempotencyKey: 'idem-dup',
    });
    const second = await mock.wallet.debit({
      userId: 'u1',
      appId: 'app1',
      usage: { inputTokens: 10, providerId: 'openai' },
      idempotencyKey: 'idem-dup',
    });

    expect(second.id).toBe(first.id);
    const bal = await mock.wallet.getBalance('u1', 'app1');
    expect(bal.balanceMicrocredits).toBe(first.deltaMicrocredits + 10_000);
  });

  it('throws when balance insufficient', async () => {
    const mock = createMockSqlWallet();
    mock.seed('u1', 'app1', 0);

    await expect(
      mock.wallet.debit({
        userId: 'u1',
        appId: 'app1',
        usage: { inputTokens: 1000, outputTokens: 1000, providerId: 'openai' },
        idempotencyKey: 'insufficient-1',
      }),
    ).rejects.toBeInstanceOf(ConsumerFundingRequiredError);
  });

  it('credits balance', async () => {
    const mock = createMockSqlWallet();
    mock.seed('u1', 'app1', 100);

    await mock.wallet.credit({
      userId: 'u1',
      appId: 'app1',
      deltaMicrocredits: 500,
      reason: 'topup',
      idempotencyKey: 'credit-1',
    });

    const bal = await mock.wallet.getBalance('u1', 'app1');
    expect(bal.balanceMicrocredits).toBe(600);
  });
});

describe('loadSqlWalletPricing', () => {
  it('loads per-app pricing row', async () => {
    const mock = createMockSqlWallet();
    mock.setPricing('app1', 'openai', 'gpt-4o', {
      input_per_1k: '40',
      output_per_1k: '120',
      min_per_request: '80',
    });

    const pricing = await loadSqlWalletPricing({ query: mock.query }, 'app1', 'openai', 'gpt-4o');
    expect(pricing).toEqual({
      inputPer1kTokens: 40,
      outputPer1kTokens: 120,
      minPerRequest: 80,
    });
  });
});
