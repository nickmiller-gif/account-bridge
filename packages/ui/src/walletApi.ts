import type { FundingPolicy, LedgerEntry } from '@account-bridge/core';

export interface WalletApiClientOptions {
  baseUrl: string;
  apiPrefix?: string;
  getAuthHeaders: () => Promise<Record<string, string>> | Record<string, string>;
  fetch?: typeof fetch;
}

export interface WalletBalanceResponse {
  balanceMicrocredits: number;
  currency: string;
  ledger?: LedgerEntry[];
  fundingPolicy?: FundingPolicy;
  walletEnabled?: boolean;
}

export interface WalletApiClient {
  getBalance(): Promise<WalletBalanceResponse>;
  listPacks(): Promise<{ packs: Array<{ id: string; label: string; priceCents: number; microcredits: number }> }>;
  startCheckout(packId: string): Promise<{ url: string; sessionId: string }>;
  devCredit(microcredits: number): Promise<void>;
}

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/$/, '')}${path}`;
}

export function createWalletApiClient(options: WalletApiClientOptions): WalletApiClient {
  const prefix = options.apiPrefix ?? '/account-bridge';
  const fetchImpl = options.fetch ?? fetch;

  async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
    const headers = await options.getAuthHeaders();
    return fetchImpl(joinUrl(options.baseUrl, `${prefix}${path}`), {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
        ...(init?.headers as Record<string, string> | undefined),
      },
    });
  }

  return {
    async getBalance() {
      const res = await apiFetch('/wallet/balance');
      if (!res.ok) throw new Error(`Wallet balance failed: ${res.status}`);
      return (await res.json()) as WalletBalanceResponse;
    },
    async listPacks() {
      const res = await apiFetch('/wallet/packs');
      if (!res.ok) throw new Error(`Wallet packs failed: ${res.status}`);
      return (await res.json()) as {
        packs: Array<{ id: string; label: string; priceCents: number; microcredits: number }>;
      };
    },
    async startCheckout(packId) {
      const res = await apiFetch('/wallet/checkout', {
        method: 'POST',
        body: JSON.stringify({ packId }),
      });
      if (!res.ok) throw new Error(`Checkout failed: ${res.status}`);
      return (await res.json()) as { url: string; sessionId: string };
    },
    async devCredit(microcredits) {
      const res = await apiFetch('/wallet/credit', {
        method: 'POST',
        body: JSON.stringify({ microcredits }),
      });
      if (!res.ok) throw new Error(`Dev credit failed: ${res.status}`);
    },
  };
}

export function formatMicrocredits(microcredits: number): string {
  const dollars = microcredits / 1_000_000;
  return `$${dollars.toFixed(2)}`;
}
