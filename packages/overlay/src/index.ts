import type { FundingPolicy } from '@account-bridge/core';
import { createBrowserHostBridge, DEFAULT_HOST_PROVIDER_IDS } from '@account-bridge/core';
import { accountBridgeThemeCss } from '@account-bridge/ui';

import {
  embedFundingReady,
  mountFundingGate,
  unmountFundingGate,
  type FundingGateContext,
} from '@account-bridge/web';

export interface AccountBridgeOverlayOptions {
  target?: HTMLElement;
  appId: string;
  fundingPolicy?: FundingPolicy;
  /** Remote host for wallet API */
  baseUrl?: string;
  apiPrefix?: string;
  getAuthHeaders?: () => Promise<Record<string, string>> | Record<string, string>;
  onOpen?: () => void;
  onClose?: () => void;
}

export interface AccountBridgeOverlayHandle {
  open(): void;
  close(): void;
  destroy(): void;
}

/**
 * Mount a floating Account Bridge FAB + panel on any page (no React required).
 * When `baseUrl` + `getAuthHeaders` are set, embeds the same funding gate as Web Components.
 */
export function mountAccountBridgeOverlay(
  options: AccountBridgeOverlayOptions,
): AccountBridgeOverlayHandle {
  const target = options.target ?? document.body;
  const policy = options.fundingPolicy ?? { mode: 'auto', wallet: { enabled: true } };

  if (!document.getElementById('account-bridge-overlay-theme')) {
    const style = document.createElement('style');
    style.id = 'account-bridge-overlay-theme';
    style.textContent = accountBridgeThemeCss;
    document.head.appendChild(style);
  }

  const root = document.createElement('div');
  root.className = 'ab-overlay-root';
  target.appendChild(root);

  const fab = document.createElement('button');
  fab.type = 'button';
  fab.className = 'ab-fab';
  fab.setAttribute('aria-label', 'Account Bridge');
  fab.textContent = '✦ AI';
  root.appendChild(fab);

  const sheet = document.createElement('div');
  sheet.className = 'ab-overlay-sheet';
  sheet.hidden = true;
  sheet.innerHTML = `
    <div class="ab-overlay-sheet__header">
      <strong>Account Bridge</strong>
      <button type="button" class="ab-overlay-close" aria-label="Close">×</button>
    </div>
    <div class="ab-overlay-sheet__body"></div>
  `;
  root.appendChild(sheet);

  const bodyHost = sheet.querySelector('.ab-overlay-sheet__body') as HTMLDivElement;
  const closeBtn = sheet.querySelector('.ab-overlay-close') as HTMLButtonElement;

  let fundingGateCtx: FundingGateContext | undefined;
  let bridge: ReturnType<typeof createBrowserHostBridge> | undefined;
  let bridgeUnsub: (() => void) | undefined;

  const embedConfig = {
    appId: options.appId,
    transport: 'remote' as const,
    baseUrl: options.baseUrl,
    apiPrefix: options.apiPrefix,
    fundingPolicy: policy,
    providerIds: DEFAULT_HOST_PROVIDER_IDS,
  };

  async function getAuthHeaders(): Promise<Record<string, string>> {
    return (await options.getAuthHeaders?.()) ?? {};
  }

  async function renderBody(): Promise<void> {
    unmountFundingGate(fundingGateCtx);
    fundingGateCtx = undefined;
    bodyHost.replaceChildren();

    if (!options.baseUrl || !options.getAuthHeaders) {
      bodyHost.innerHTML = `
        <p>Fund AI with your own provider keys (BYOK) or app credits.</p>
        <p><small>Mode: <code>${policy.mode}</code> · App: <code>${options.appId}</code></small></p>
        <p>Configure <code>baseUrl</code> and <code>getAuthHeaders</code> for embedded settings.</p>
      `;
      return;
    }

    bridge =
      bridge ??
      createBrowserHostBridge({
        appId: options.appId,
        baseUrl: options.baseUrl,
        getAuthHeaders: options.getAuthHeaders,
        apiPrefix: options.apiPrefix,
        providerIds: DEFAULT_HOST_PROVIDER_IDS,
      });

    if (!bridgeUnsub) {
      bridgeUnsub = bridge.subscribe((event) => {
        if (event.type === 'connect' || event.type === 'disconnect' || event.type === 'preferences') {
          if (!sheet.hidden) void renderBody();
        }
      });
    }

    const ready = await embedFundingReady(bridge, embedConfig, getAuthHeaders);
    if (ready) {
      bodyHost.innerHTML = `
        <p class="ab-overlay-ready">✓ AI funding is ready.</p>
        <p><small>Mode: <code>${policy.mode}</code> · App: <code>${options.appId}</code></small></p>
      `;
      return;
    }

    fundingGateCtx = mountFundingGate(bodyHost, {
      bridge,
      config: embedConfig,
      getAuthHeaders,
      providerIds: DEFAULT_HOST_PROVIDER_IDS,
      compact: true,
    });
  }

  function open() {
    sheet.hidden = false;
    fab.classList.add('ab-fab--open');
    void renderBody();
    options.onOpen?.();
  }

  function close() {
    sheet.hidden = true;
    fab.classList.remove('ab-fab--open');
    options.onClose?.();
  }

  fab.addEventListener('click', () => {
    if (sheet.hidden) open();
    else close();
  });
  closeBtn.addEventListener('click', close);

  window.addEventListener('focus', () => {
    if (!sheet.hidden) void renderBody();
  });

  return {
    open,
    close,
    destroy() {
      bridgeUnsub?.();
      bridgeUnsub = undefined;
      unmountFundingGate(fundingGateCtx);
      root.remove();
    },
  };
}
