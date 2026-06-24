import { describe, expect, it } from 'vitest';

import { ConsumerFundingRequiredError } from '@account-bridge/core';

import { bridgeFundingReady, ensureBridgeFundingReady } from './fundingReady.js';

describe('bridgeFundingReady', () => {
  it('uses getFundingStatus when available', async () => {
    const bridge = {
      getFundingStatus: async () => ({
        ready: true,
        fundingPolicy: { mode: 'auto' as const, wallet: { enabled: true } },
        walletEnabled: true,
        connectedCount: 0,
        defaultProvider: null,
      }),
    };

    await expect(bridgeFundingReady(bridge as never)).resolves.toBe(true);
  });
});

describe('ensureBridgeFundingReady', () => {
  it('throws ConsumerFundingRequiredError when remote status not ready', async () => {
    const bridge = {
      getFundingStatus: async () => ({
        ready: false,
        fundingPolicy: { mode: 'wallet' as const, wallet: { enabled: true } },
        walletEnabled: true,
        connectedCount: 0,
        defaultProvider: null,
      }),
    };

    await expect(ensureBridgeFundingReady(bridge as never)).rejects.toBeInstanceOf(
      ConsumerFundingRequiredError,
    );
  });

  it('returns provider hint from remote status when ready', async () => {
    const bridge = {
      getFundingStatus: async () => ({
        ready: true,
        fundingPolicy: { mode: 'auto' as const, wallet: { enabled: true } },
        walletEnabled: true,
        connectedCount: 1,
        defaultProvider: 'anthropic' as const,
      }),
    };

    await expect(ensureBridgeFundingReady(bridge as never)).resolves.toBe('anthropic');
  });
});
