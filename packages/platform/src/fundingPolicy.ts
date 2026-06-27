import type { FundingPolicy } from '@account-bridge/core';

import type { PlatformPlan } from './types.js';

export function fundingPolicyUsesWallet(policy: FundingPolicy): boolean {
  if (policy.mode === 'wallet') return true;
  if (policy.mode === 'auto' && policy.wallet?.enabled) return true;
  return false;
}

export function assertFundingPolicyAllowed(plan: PlatformPlan, policy: FundingPolicy): void {
  if (fundingPolicyUsesWallet(policy) && !plan.walletEnabled) {
    throw new Error('Wallet funding requires a Pro or Business plan.');
  }
}
