import type { PlatformPlan, PlanId } from './types.js';

export const PLATFORM_PLANS: Record<PlanId, PlatformPlan> = {
  free: {
    id: 'free',
    name: 'Free',
    priceCents: 0,
    maxApps: 1,
    maxMonthlyRequests: 5_000,
    walletEnabled: false,
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    priceCents: 4900,
    maxApps: 5,
    maxMonthlyRequests: 100_000,
    walletEnabled: true,
  },
  business: {
    id: 'business',
    name: 'Business',
    priceCents: 19900,
    maxApps: 25,
    maxMonthlyRequests: 1_000_000,
    walletEnabled: true,
  },
};

export function getPlan(planId: PlanId): PlatformPlan {
  return PLATFORM_PLANS[planId];
}

export function planAllowsRequest(planId: PlanId, monthlyRequestCount: number): boolean {
  return monthlyRequestCount < PLATFORM_PLANS[planId].maxMonthlyRequests;
}
