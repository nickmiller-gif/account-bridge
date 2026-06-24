import type { FundingPolicy, ProviderId } from '@account-bridge/core';

export interface FundingStatusInput {
  fundingPolicy: FundingPolicy;
  defaultProvider: ProviderId | null;
  connectedCount: number;
  walletBalanceMicrocredits?: number;
}

export interface ComputedFundingStatus {
  ready: boolean;
  walletEnabled: boolean;
  hasByok: boolean;
  hasWallet: boolean;
}

/** Pure readiness matrix for GET /account-bridge/status (unit-tested). */
export function computeFundingStatus(input: FundingStatusInput): ComputedFundingStatus {
  const fundingPolicy = input.fundingPolicy;
  const walletEnabled = Boolean(fundingPolicy.wallet?.enabled);
  const hasByok = Boolean(input.defaultProvider || input.connectedCount > 0);
  const hasWallet =
    walletEnabled && (input.walletBalanceMicrocredits ?? 0) > 0 && fundingPolicy.mode !== 'byok';
  const ready =
    fundingPolicy.mode === 'byok'
      ? hasByok
      : fundingPolicy.mode === 'wallet'
        ? hasWallet
        : hasByok || hasWallet;

  return { ready, walletEnabled, hasByok, hasWallet };
}
