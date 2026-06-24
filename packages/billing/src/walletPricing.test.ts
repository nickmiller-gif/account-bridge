import { describe, expect, it } from 'vitest';

import { mergeWalletPricing, resolveWalletDebitPricing } from './walletPricing.js';

describe('walletPricing', () => {
  it('mergeWalletPricing prefers override fields', () => {
    expect(
      mergeWalletPricing(
        { inputPer1kTokens: 50, outputPer1kTokens: 150, minPerRequest: 100 },
        { inputPer1kTokens: 40 },
      ),
    ).toEqual({ inputPer1kTokens: 40, outputPer1kTokens: 150, minPerRequest: 100 });
  });

  it('resolveWalletDebitPricing merges policy and loader', async () => {
    const loader = async () => ({ outputPer1kTokens: 200 });
    const pricing = await resolveWalletDebitPricing(
      loader,
      { inputPer1kTokens: 50, outputPer1kTokens: 150 },
      'app-1',
      'openai',
      'gpt-4o',
    );
    expect(pricing).toEqual({ inputPer1kTokens: 50, outputPer1kTokens: 200 });
  });

  it('resolveWalletDebitPricing returns policy when no loader', async () => {
    const pricing = await resolveWalletDebitPricing(
      undefined,
      { minPerRequest: 100 },
      'app-1',
      'openai',
    );
    expect(pricing).toEqual({ minPerRequest: 100 });
  });
});
