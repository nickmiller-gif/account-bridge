import type { FundingPolicy } from '@account-bridge/core';
import { consumerCreditsReady } from '@account-bridge/core';
import type { AccountBridge } from '@account-bridge/core';

import { createWalletApiClient, formatMicrocredits, type WalletApiClient } from './walletApi.js';

export interface WalletViewState {
  loading: boolean;
  balanceMicrocredits: number;
  formattedBalance: string;
  walletEnabled: boolean;
  fundingPolicy: FundingPolicy;
  packs: Array<{ id: string; label: string; priceCents: number; microcredits: number }>;
  error: string | null;
  busy: boolean;
}

export interface WalletControllerOptions {
  bridge: AccountBridge;
  walletApi?: WalletApiClient;
  fundingPolicy?: FundingPolicy;
}

export class WalletController {
  private readonly bridge: AccountBridge;
  private readonly walletApi?: WalletApiClient;
  private readonly fundingPolicy: FundingPolicy;
  private loading = true;
  private balanceMicrocredits = 0;
  private walletEnabled = false;
  private packs: WalletViewState['packs'] = [];
  private error: string | null = null;
  private busy = false;
  private readonly listeners = new Set<(state: WalletViewState) => void>();

  constructor(options: WalletControllerOptions) {
    this.bridge = options.bridge;
    this.walletApi = options.walletApi;
    this.fundingPolicy = options.fundingPolicy ?? { mode: 'byok' };
    void this.refresh();
  }

  getState(): WalletViewState {
    return {
      loading: this.loading,
      balanceMicrocredits: this.balanceMicrocredits,
      formattedBalance: formatMicrocredits(this.balanceMicrocredits),
      walletEnabled: this.walletEnabled,
      fundingPolicy: this.fundingPolicy,
      packs: this.packs,
      error: this.error,
      busy: this.busy,
    };
  }

  subscribe(listener: (state: WalletViewState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    const state = this.getState();
    for (const l of this.listeners) l(state);
  }

  async refresh(): Promise<void> {
    if (!this.walletApi) {
      this.loading = false;
      this.walletEnabled = Boolean(this.fundingPolicy.wallet?.enabled);
      this.emit();
      return;
    }
    this.loading = true;
    this.error = null;
    this.emit();
    try {
      const [balance, packsRes] = await Promise.all([
        this.walletApi.getBalance(),
        this.walletApi.listPacks(),
      ]);
      this.balanceMicrocredits = balance.balanceMicrocredits;
      this.walletEnabled = balance.walletEnabled ?? Boolean(this.fundingPolicy.wallet?.enabled);
      this.packs = packsRes.packs;
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to load wallet';
    } finally {
      this.loading = false;
      this.emit();
    }
  }

  async buyPack(packId: string): Promise<void> {
    if (!this.walletApi) return;
    this.busy = true;
    this.error = null;
    this.emit();
    try {
      const { url } = await this.walletApi.startCheckout(packId);
      const g = globalThis as { location?: { href: string } };
      if (g.location) g.location.href = url;
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Checkout failed';
    } finally {
      this.busy = false;
      this.emit();
    }
  }
}

export async function consumerFundingReady(
  bridge: AccountBridge,
  fundingPolicy: FundingPolicy = { mode: 'byok' },
  walletBalanceMicrocredits = 0,
): Promise<boolean> {
  const mode = fundingPolicy.mode;
  if (mode === 'byok') {
    return consumerCreditsReady(bridge);
  }
  if (mode === 'wallet') {
    return walletBalanceMicrocredits > 0;
  }
  return (await consumerCreditsReady(bridge)) || walletBalanceMicrocredits > 0;
}

export { createWalletApiClient, formatMicrocredits };
