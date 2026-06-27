import type { PlatformApp, PlatformPlan } from './types.js';

export interface AppUsageSummary {
  monthlyRequestCount: number;
  monthlyRequestLimit: number;
  usagePercent: number;
  requestsRemaining: number;
}

export function appUsageSummary(app: PlatformApp, plan: PlatformPlan): AppUsageSummary {
  return usageFromCount(app.monthlyRequestCount, plan.maxMonthlyRequests);
}

export function usageFromCount(monthlyRequestCount: number, monthlyRequestLimit: number): AppUsageSummary {
  const usagePercent =
    monthlyRequestLimit > 0
      ? Math.min(100, Math.round((monthlyRequestCount / monthlyRequestLimit) * 100))
      : 0;

  return {
    monthlyRequestCount,
    monthlyRequestLimit,
    usagePercent,
    requestsRemaining: Math.max(0, monthlyRequestLimit - monthlyRequestCount),
  };
}
