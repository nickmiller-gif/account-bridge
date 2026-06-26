import type { PlatformStore } from './types.js';

/** Account-wide monthly request count across all apps for a host. */
export async function hostMonthlyRequestCount(
  store: PlatformStore,
  hostId: string,
): Promise<number> {
  const apps = await store.listAppsForHost(hostId);
  return apps.reduce((sum, app) => sum + app.monthlyRequestCount, 0);
}
