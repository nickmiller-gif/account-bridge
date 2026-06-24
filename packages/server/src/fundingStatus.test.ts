import { describe, expect, it } from 'vitest';

import { computeFundingStatus } from '../src/fundingStatus.js';

describe('computeFundingStatus', () => {
  it('byok mode requires connected provider', () => {
    expect(
      computeFundingStatus({
        fundingPolicy: { mode: 'byok' },
        defaultProvider: null,
        connectedCount: 0,
      }),
    ).toEqual({ ready: false, walletEnabled: false, hasByok: false, hasWallet: false });

    expect(
      computeFundingStatus({
        fundingPolicy: { mode: 'byok' },
        defaultProvider: 'openai',
        connectedCount: 1,
      }),
    ).toEqual({ ready: true, walletEnabled: false, hasByok: true, hasWallet: false });
  });

  it('wallet mode requires positive balance when wallet enabled', () => {
    expect(
      computeFundingStatus({
        fundingPolicy: { mode: 'wallet', wallet: { enabled: true } },
        defaultProvider: 'openai',
        connectedCount: 1,
        walletBalanceMicrocredits: 0,
      }),
    ).toEqual({ ready: false, walletEnabled: true, hasByok: true, hasWallet: false });

    expect(
      computeFundingStatus({
        fundingPolicy: { mode: 'wallet', wallet: { enabled: true } },
        defaultProvider: null,
        connectedCount: 0,
        walletBalanceMicrocredits: 5_000,
      }),
    ).toEqual({ ready: true, walletEnabled: true, hasByok: false, hasWallet: true });
  });

  it('auto mode accepts BYOK or wallet balance', () => {
    expect(
      computeFundingStatus({
        fundingPolicy: { mode: 'auto', wallet: { enabled: true } },
        defaultProvider: null,
        connectedCount: 0,
        walletBalanceMicrocredits: 0,
      }),
    ).toEqual({ ready: false, walletEnabled: true, hasByok: false, hasWallet: false });

    expect(
      computeFundingStatus({
        fundingPolicy: { mode: 'auto', wallet: { enabled: true } },
        defaultProvider: null,
        connectedCount: 0,
        walletBalanceMicrocredits: 100,
      }),
    ).toEqual({ ready: true, walletEnabled: true, hasByok: false, hasWallet: true });

    expect(
      computeFundingStatus({
        fundingPolicy: { mode: 'auto', wallet: { enabled: true } },
        defaultProvider: 'anthropic',
        connectedCount: 1,
        walletBalanceMicrocredits: 0,
      }),
    ).toEqual({ ready: true, walletEnabled: true, hasByok: true, hasWallet: false });
  });

  it('wallet balance ignored when wallet disabled or mode is byok', () => {
    expect(
      computeFundingStatus({
        fundingPolicy: { mode: 'byok', wallet: { enabled: true } },
        defaultProvider: null,
        connectedCount: 0,
        walletBalanceMicrocredits: 99_999,
      }),
    ).toEqual({ ready: false, walletEnabled: true, hasByok: false, hasWallet: false });
  });
});
