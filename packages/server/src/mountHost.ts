import type { Express } from 'express';

import type { ServerHostBridgeConfig, HostKeyPool, WalletStore } from '@account-bridge/core';
import {
  createHostKeyPool,
  createServerBridgeFactory,
  resolveHostProviders,
} from '@account-bridge/core/node';
import { mountAccountBridgeGateway } from '@account-bridge/adapters/express';
import type { StripeBillingConfig, WalletPricingLoader, WalletStreamDebitTiming } from '@account-bridge/billing';

import { mountAccountBridgeHostRoutes } from './hostRoutes.js';
import { mountAccountBridgeOAuth } from './mountOAuth.js';
import type { GoogleOAuthConfig, MicrosoftOAuthConfig, OAuthStateStore } from './oauth.js';
import { mountAccountBridgeWalletRoutes } from './walletRoutes.js';

export interface MountAccountBridgeHostOptions {
  app: Express;
  config: ServerHostBridgeConfig;
  resolveUser: (req: { headers: Record<string, string | string[] | undefined> }) =>
    | Promise<string | null>
    | string
    | null;
  stateStore?: OAuthStateStore;
  google?: GoogleOAuthConfig;
  microsoft?: MicrosoftOAuthConfig;
  oauthSuccessRedirect?: string;
  enforceConsumerCredits?: boolean;
  /** Wallet ledger for prepaid credits */
  wallet?: WalletStore;
  /** Override auto-created host key pool */
  hostKeyPool?: HostKeyPool;
  /** Stripe config when wallet.top-up enabled */
  stripe?: StripeBillingConfig;
  /** Merged with fundingPolicy.pricing on wallet debits (e.g. createSqlWalletPricingLoader) */
  walletPricingLoader?: WalletPricingLoader;
  /** SSE wallet debit timing — default `after_content` (best-effort post-flush) */
  walletStreamDebit?: WalletStreamDebitTiming;
}

/** One-call Express mount — gateway + settings API + optional OAuth + wallet. */
export function mountAccountBridgeHost(options: MountAccountBridgeHostOptions): void {
  const createBridge = createServerBridgeFactory({
    ...options.config,
    googleOAuth: options.google
      ? { clientId: options.google.clientId, clientSecret: options.google.clientSecret }
      : undefined,
    microsoftOAuth: options.microsoft
      ? {
          clientId: options.microsoft.clientId,
          clientSecret: options.microsoft.clientSecret,
          tenantId: options.microsoft.tenantId,
        }
      : undefined,
  });
  const enforce = options.enforceConsumerCredits !== false;
  const apiPrefix = options.config.apiPrefix ?? '/account-bridge';
  const fundingPolicy = options.config.fundingPolicy;
  const providers = resolveHostProviders(options.config);

  const hostKeyPool =
    options.hostKeyPool ??
    (fundingPolicy?.mode === 'wallet' || fundingPolicy?.mode === 'auto'
      ? createHostKeyPool({ providers })
      : undefined);

  mountAccountBridgeGateway(options.app, {
    resolveUser: options.resolveUser,
    createBridge,
    enforceConsumerCredits: enforce,
    appId: options.config.appId,
    fundingPolicy,
    wallet: options.wallet,
    hostKeyPool,
    walletPricingLoader: options.walletPricingLoader,
    walletStreamDebit: options.walletStreamDebit,
  });

  mountAccountBridgeHostRoutes({
    app: options.app,
    apiPrefix,
    resolveUser: options.resolveUser,
    createBridge,
    enforceConsumerCredits: enforce,
    fundingPolicy,
    wallet: options.wallet,
    hostKeyPool,
    appId: options.config.appId,
    walletPricingLoader: options.walletPricingLoader,
    walletStreamDebit: options.walletStreamDebit,
  });

  if (options.wallet) {
    mountAccountBridgeWalletRoutes({
      app: options.app,
      apiPrefix,
      appId: options.config.appId,
      wallet: options.wallet,
      fundingPolicy,
      resolveUser: options.resolveUser,
      stripe: options.stripe,
      enforceConsumerCredits: enforce,
    });
  }

  if (options.stateStore && (options.google || options.microsoft)) {
    mountAccountBridgeOAuth({
      app: options.app,
      google: options.google,
      microsoft: options.microsoft,
      stateStore: options.stateStore,
      resolveUser: options.resolveUser,
      createBridge,
      successRedirect: options.oauthSuccessRedirect,
      basePath: options.config.oauthBasePath ?? `${apiPrefix.replace(/\/$/, '')}/oauth`,
    });
  }
}
