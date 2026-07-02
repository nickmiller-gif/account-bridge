import type { AccountBridge, ProviderId } from '@account-bridge/core';
import type { FundingPolicy } from '@account-bridge/core';
import {
  bridgeFundingReady,
  consumerFundingReady,
  createSettingsController,
  createWalletApiClient,
  WalletController,
} from '@account-bridge/ui';

import type { AccountBridgeEmbedConfig } from './types.js';
import { oauthStartUrlFor } from './bootstrap.js';
import { mountSettingsView, unmountSettingsView, type SettingsRenderContext } from './renderSettings.js';

export interface FundingGateContext {
  root: HTMLElement;
  settingsCtx?: SettingsRenderContext;
  walletUnsub?: () => void;
}

function fundingPolicyFromConfig(config: AccountBridgeEmbedConfig): FundingPolicy {
  return config.fundingPolicy ?? { mode: 'byok' };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function embedFundingReady(
  bridge: AccountBridge,
  config: AccountBridgeEmbedConfig,
  getAuthHeaders: () => Promise<Record<string, string>>,
  providerId?: ProviderId,
): Promise<boolean> {
  const policy = fundingPolicyFromConfig(config);
  if (bridge.getFundingStatus) {
    return bridgeFundingReady(bridge, providerId);
  }
  if (policy.mode === 'byok') {
    const { consumerCreditsReady } = await import('@account-bridge/core');
    return consumerCreditsReady(bridge, providerId);
  }
  if (config.transport === 'remote' && config.baseUrl && policy.wallet?.enabled) {
    const api = createWalletApiClient({
      baseUrl: config.baseUrl,
      apiPrefix: config.apiPrefix,
      getAuthHeaders,
    });
    const balance = await api.getBalance();
    return consumerFundingReady(bridge, policy, balance.balanceMicrocredits);
  }
  const { consumerCreditsReady } = await import('@account-bridge/core');
  return consumerCreditsReady(bridge, providerId);
}

export function mountFundingGate(
  host: HTMLElement,
  options: {
    bridge: AccountBridge;
    config: AccountBridgeEmbedConfig;
    getAuthHeaders: () => Promise<Record<string, string>>;
    providerIds: ProviderId[];
    compact?: boolean;
  },
): FundingGateContext {
  const policy = fundingPolicyFromConfig(options.config);
  const showWallet = Boolean(policy.wallet?.enabled) && policy.mode !== 'byok';

  const root = document.createElement('div');
  root.className = 'ab-gate';
  root.innerHTML = `<div class="ab-gate__hero">
    <span class="ab-gate__icon" aria-hidden>✦</span>
    <h3 class="ab-gate__title">Fund AI to continue</h3>
    <p class="ab-gate__text">Connect your own provider or add app credits—you stay in control of spend.</p>
  </div>`;

  const tabs = document.createElement('div');
  tabs.className = 'ab-gate__tabs';
  const byokTab = document.createElement('button');
  byokTab.type = 'button';
  byokTab.className = 'ab-gate__tab ab-gate__tab--active';
  byokTab.textContent = 'My accounts';
  const walletTab = document.createElement('button');
  walletTab.type = 'button';
  walletTab.className = 'ab-gate__tab';
  walletTab.textContent = 'App credits';

  const panel = document.createElement('div');
  panel.className = 'ab-gate__panel';

  if (showWallet) {
    root.appendChild(tabs);
    tabs.appendChild(byokTab);
    tabs.appendChild(walletTab);
  }
  root.appendChild(panel);
  host.replaceChildren(root);

  const settingsController = createSettingsController({
    bridge: options.bridge,
    providerIds: options.providerIds,
    getOAuthStartUrl: (key) => oauthStartUrlFor(options.config, key),
  });

  let settingsCtx: SettingsRenderContext | undefined;
  let walletUnsub: (() => void) | undefined;
  let activeTab: 'byok' | 'wallet' = 'byok';

  const walletApi =
    options.config.transport === 'remote' && options.config.baseUrl
      ? createWalletApiClient({
          baseUrl: options.config.baseUrl,
          apiPrefix: options.config.apiPrefix,
          getAuthHeaders: options.getAuthHeaders,
        })
      : undefined;

  const walletController = new WalletController({
    bridge: options.bridge,
    walletApi,
    fundingPolicy: policy,
  });

  const renderWalletPanel = () => {
    panel.replaceChildren();
    const wrap = document.createElement('div');
    wrap.className = 'ab-wallet';
    panel.appendChild(wrap);

    walletUnsub?.();
    walletUnsub = walletController.subscribe((state) => {
      wrap.innerHTML = state.loading
        ? '<p>Loading balance…</p>'
        : `<p class="ab-wallet__balance">${escapeHtml(state.formattedBalance)} credits</p>
           ${state.error ? `<p role="alert">${escapeHtml(state.error)}</p>` : ''}`;
      if (!state.loading && state.packs.length) {
        const list = document.createElement('div');
        list.className = 'ab-wallet__packs';
        for (const pack of state.packs) {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'ab-wallet__pack';
          btn.textContent = `${pack.label} — $${(pack.priceCents / 100).toFixed(2)}`;
          btn.disabled = state.busy;
          btn.onclick = () => void walletController.buyPack(pack.id);
          list.appendChild(btn);
        }
        wrap.appendChild(list);
      }
    });
  };

  const renderByokPanel = () => {
    unmountSettingsView(settingsCtx);
    settingsCtx = mountSettingsView(panel, settingsController, options.compact ?? true);
  };

  const setTab = (tab: 'byok' | 'wallet') => {
    activeTab = tab;
    byokTab.className = tab === 'byok' ? 'ab-gate__tab ab-gate__tab--active' : 'ab-gate__tab';
    walletTab.className = tab === 'wallet' ? 'ab-gate__tab ab-gate__tab--active' : 'ab-gate__tab';
    if (tab === 'wallet') renderWalletPanel();
    else renderByokPanel();
  };

  byokTab.onclick = () => setTab('byok');
  walletTab.onclick = () => setTab('wallet');
  renderByokPanel();

  return { root, settingsCtx, walletUnsub };
}

export function unmountFundingGate(ctx: FundingGateContext | undefined): void {
  unmountSettingsView(ctx?.settingsCtx);
  ctx?.walletUnsub?.();
}
