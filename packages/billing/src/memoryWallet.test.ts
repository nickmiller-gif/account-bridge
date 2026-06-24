import { describe, expect, it } from 'vitest';

import { estimateUsageMicrocredits } from './pricing.js';
import { memoryWalletStore } from './memoryWallet.js';

describe('memoryWalletStore', () => {
  it('debits idempotently', async () => {
    const wallet = memoryWalletStore();
    wallet.seed('u1', 'app1', 10_000);

    const params = {
      userId: 'u1',
      appId: 'app1',
      usage: { inputTokens: 1000, outputTokens: 500 },
      idempotencyKey: 'req-1',
    };

    const first = await wallet.debit(params);
    const second = await wallet.debit(params);
    expect(second.id).toBe(first.id);

    const balance = await wallet.getBalance('u1', 'app1');
    expect(balance.balanceMicrocredits).toBeLessThan(10_000);
  });

  it('throws when balance insufficient', async () => {
    const wallet = memoryWalletStore();
    wallet.seed('u1', 'app1', 10);

    await expect(
      wallet.debit({
        userId: 'u1',
        appId: 'app1',
        usage: { inputTokens: 100_000, outputTokens: 100_000 },
        idempotencyKey: 'req-2',
      }),
    ).rejects.toThrow(/Insufficient/);
  });
});

describe('estimateUsageMicrocredits', () => {
  it('uses minimum when usage unknown', () => {
    expect(estimateUsageMicrocredits({})).toBe(100);
  });
});
