import type { ProviderId, WalletPricing } from '@account-bridge/core';

import { loadSqlWalletPricing, type SqlWalletStoreOptions } from './sqlWallet.js';

export type WalletPricingLoader = (
  appId: string,
  providerId: ProviderId,
  model?: string,
) => Promise<WalletPricing | undefined>;

export function mergeWalletPricing(
  base?: WalletPricing,
  override?: WalletPricing,
): WalletPricing | undefined {
  if (!base && !override) return undefined;
  return { ...base, ...override };
}

export async function resolveWalletDebitPricing(
  loader: WalletPricingLoader | undefined,
  policyPricing: WalletPricing | undefined,
  appId: string,
  providerId: ProviderId,
  model?: string,
): Promise<WalletPricing | undefined> {
  if (!loader) return policyPricing;
  const sqlPricing = await loader(appId, providerId, model);
  return mergeWalletPricing(policyPricing, sqlPricing);
}

export function createSqlWalletPricingLoader(
  options: Pick<SqlWalletStoreOptions, 'query' | 'tablePrefix'>,
): WalletPricingLoader {
  return (appId, providerId, model) =>
    loadSqlWalletPricing(options, appId, providerId, model ?? '*');
}
