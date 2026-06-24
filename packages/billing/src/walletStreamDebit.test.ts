import { describe, expect, it, vi } from 'vitest';

import { ConsumerFundingRequiredError } from '@account-bridge/core';

import {
  debitWalletForStream,
  estimateStreamPreDebitUsage,
} from './walletStreamDebit.js';

describe('walletStreamDebit', () => {
  it('estimateStreamPreDebitUsage includes output estimate', () => {
    expect(estimateStreamPreDebitUsage(400, 'openai', 'gpt-4o')).toEqual({
      inputTokens: 100,
      outputTokens: 500,
      model: 'gpt-4o',
      providerId: 'openai',
    });
  });

  it('before_stream debits and propagates failure', async () => {
    const debit = vi.fn().mockRejectedValue(new ConsumerFundingRequiredError('nope'));
    await expect(
      debitWalletForStream('before_stream', 'before_stream', {
        wallet: { debit } as never,
        userId: 'u1',
        appId: 'app',
        idempotencyKey: 'k1',
        usage: estimateStreamPreDebitUsage(100, 'openai'),
      }),
    ).rejects.toThrow('nope');
    expect(debit).toHaveBeenCalledOnce();
  });

  it('after_content swallows debit failure', async () => {
    const onError = vi.fn();
    const debit = vi.fn().mockRejectedValue(new ConsumerFundingRequiredError('nope'));
    await debitWalletForStream(
      'after_content',
      'after_content',
      {
        wallet: { debit } as never,
        userId: 'u1',
        appId: 'app',
        idempotencyKey: 'k1',
        usage: { inputTokens: 10, providerId: 'openai' },
      },
      onError,
    );
    expect(onError).toHaveBeenCalledOnce();
  });

  it('skips when timing mode does not match phase', async () => {
    const debit = vi.fn();
    await debitWalletForStream('after_content', 'before_stream', {
      wallet: { debit } as never,
      userId: 'u1',
      appId: 'app',
      idempotencyKey: 'k1',
      usage: { inputTokens: 10, providerId: 'openai' },
    });
    expect(debit).not.toHaveBeenCalled();
  });
});
