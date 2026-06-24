import type { FundingPolicy } from './types.js';

export const DEFAULT_FUNDING_POLICY: FundingPolicy = {
  mode: 'byok',
};

const policyRegistry = new Map<string, FundingPolicy>();

export function registerFundingPolicy(appId: string, policy: FundingPolicy): void {
  policyRegistry.set(appId, policy);
}

export function getFundingPolicy(appId: string): FundingPolicy {
  return policyRegistry.get(appId) ?? DEFAULT_FUNDING_POLICY;
}

export function resolveFundingPolicy(
  appId: string,
  override?: FundingPolicy,
): FundingPolicy {
  if (override) return override;
  return getFundingPolicy(appId);
}
