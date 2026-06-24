import { ConsumerFundingRequiredError } from '@account-bridge/core';
import type {
  LedgerEntry,
  WalletBalance,
  WalletCreditParams,
  WalletDebitParams,
  WalletStore,
} from '@account-bridge/core';

import { estimateUsageMicrocredits } from './pricing.js';

function walletKey(userId: string, appId: string): string {
  return `${appId}:${userId}`;
}

export function memoryWalletStore(): WalletStore & {
  /** Test helper — seed balance */
  seed(userId: string, appId: string, microcredits: number): void;
} {
  const balances = new Map<string, number>();
  const ledger: LedgerEntry[] = [];
  const idempotency = new Set<string>();

  function getOrCreateBalance(userId: string, appId: string): number {
    const key = walletKey(userId, appId);
    if (!balances.has(key)) balances.set(key, 0);
    return balances.get(key)!;
  }

  return {
    seed(userId, appId, microcredits) {
      balances.set(walletKey(userId, appId), microcredits);
    },

    async getBalance(userId, appId) {
      return {
        balanceMicrocredits: getOrCreateBalance(userId, appId),
        currency: 'usd',
      };
    },

    async assertSufficientBalance(userId, appId, estimatedMicrocredits) {
      const balance = getOrCreateBalance(userId, appId);
      if (balance < estimatedMicrocredits) {
        throw new ConsumerFundingRequiredError(
          'Insufficient app credits. Add credits in Account Bridge settings.',
        );
      }
    },

    async debit(params) {
      if (idempotency.has(params.idempotencyKey)) {
        const existing = ledger.find((e) => e.idempotencyKey === params.idempotencyKey);
        if (existing) return existing;
      }

      const cost = estimateUsageMicrocredits(params.usage, params.pricing);
      const key = walletKey(params.userId, params.appId);
      const balance = getOrCreateBalance(params.userId, params.appId);
      if (balance < cost) {
        throw new ConsumerFundingRequiredError('Insufficient app credits.');
      }
      balances.set(key, balance - cost);

      const entry: LedgerEntry = {
        id: `led_${ledger.length + 1}`,
        userId: params.userId,
        appId: params.appId,
        deltaMicrocredits: -cost,
        reason: 'usage',
        usage: params.usage,
        idempotencyKey: params.idempotencyKey,
        createdAt: new Date().toISOString(),
      };
      ledger.push(entry);
      idempotency.add(params.idempotencyKey);
      return entry;
    },

    async credit(params) {
      if (idempotency.has(params.idempotencyKey)) {
        const existing = ledger.find((e) => e.idempotencyKey === params.idempotencyKey);
        if (existing) return existing;
      }

      const key = walletKey(params.userId, params.appId);
      const balance = getOrCreateBalance(params.userId, params.appId);
      balances.set(key, balance + params.deltaMicrocredits);

      const entry: LedgerEntry = {
        id: `led_${ledger.length + 1}`,
        userId: params.userId,
        appId: params.appId,
        deltaMicrocredits: params.deltaMicrocredits,
        reason: params.reason,
        idempotencyKey: params.idempotencyKey,
        createdAt: new Date().toISOString(),
      };
      ledger.push(entry);
      idempotency.add(params.idempotencyKey);
      return entry;
    },

    async listLedger(userId, appId, limit = 20) {
      return ledger
        .filter((e) => e.userId === userId && e.appId === appId)
        .slice(-limit)
        .reverse();
    },
  };
}
