import type { AccountBridge, ProviderId } from '@account-bridge/core';
import { DEFAULT_HOST_PROVIDER_IDS } from '@account-bridge/core';
import {
  copilotDefaultsForProvider,
  createCopilotController,
  createSettingsController,
} from '@account-bridge/ui';

import type { AccountBridgeEmbedConfig } from './types.js';
import {
  configFromElement,
  createBridgeFromConfig,
  oauthStartUrlFor,
  resolveAuthHeaders,
} from './bootstrap.js';
import {
  embedFundingReady,
  mountFundingGate,
  unmountFundingGate,
  type FundingGateContext,
} from './fundingGate.js';
import { mountCopilotView, unmountCopilotView, type CopilotRenderContext } from './renderCopilot.js';
import { mountSettingsView, unmountSettingsView, type SettingsRenderContext } from './renderSettings.js';
import { ensureAccountBridgeTheme, themeClassFor } from './theme.js';

const BRIDGE_KEY = Symbol('accountBridge');
const BRIDGE_UNSUB_KEY = Symbol('bridgeUnsub');

type BridgeHost = HTMLElement & {
  [BRIDGE_KEY]?: AccountBridge;
  [BRIDGE_UNSUB_KEY]?: () => void;
};

async function bridgeForElement(el: BridgeHost): Promise<AccountBridge> {
  if (el[BRIDGE_KEY]) return el[BRIDGE_KEY]!;
  const config = configFromElement(el);
  const getAuthHeaders = async () => resolveAuthHeaders(el, config);
  const bridge = createBridgeFromConfig(config, getAuthHeaders);
  el[BRIDGE_KEY] = bridge;
  return bridge;
}

function teardownBridge(el: BridgeHost): void {
  el[BRIDGE_UNSUB_KEY]?.();
  el[BRIDGE_UNSUB_KEY] = undefined;
  delete el[BRIDGE_KEY];
}

function providerIdsFor(el: HTMLElement): ProviderId[] {
  const config = configFromElement(el);
  const raw = config.providerIds ?? DEFAULT_HOST_PROVIDER_IDS;
  if (config.includeMicrosoftCopilot && !raw.includes('microsoft_copilot')) {
    return [...raw, 'microsoft_copilot'];
  }
  return raw;
}

function embedMode(el: HTMLElement): AccountBridgeEmbedConfig['mode'] {
  return configFromElement(el).mode ?? 'full';
}

export class AccountBridgeSettingsElement extends HTMLElement {
  static observedAttributes = ['app-id', 'transport', 'base-url', 'theme', 'compact'];

  private themeWrap: HTMLDivElement | null = null;
  private settingsCtx: SettingsRenderContext | undefined;

  connectedCallback(): void {
    ensureAccountBridgeTheme();
    void this.mount();
  }

  disconnectedCallback(): void {
    unmountSettingsView(this.settingsCtx);
    this.settingsCtx = undefined;
    teardownBridge(this);
  }

  attributeChangedCallback(): void {
    if (this.isConnected) {
      unmountSettingsView(this.settingsCtx);
      this.settingsCtx = undefined;
      teardownBridge(this);
      void this.mount();
    }
  }

  private async mount(): Promise<void> {
    const config = configFromElement(this);
    const bridge = await bridgeForElement(this);
    const controller = createSettingsController({
      bridge,
      providerIds: providerIdsFor(this),
      getOAuthStartUrl: (key) => oauthStartUrlFor(config, key),
    });

    this.themeWrap = document.createElement('div');
    this.themeWrap.className = themeClassFor(config.theme);
    this.replaceChildren(this.themeWrap);

    this.settingsCtx = mountSettingsView(this.themeWrap, controller, config.compact);
  }
}

export class AccountBridgeCopilotElement extends HTMLElement {
  static observedAttributes = [
    'app-id',
    'transport',
    'base-url',
    'provider-id',
    'title',
    'subtitle',
    'stream',
    'theme',
  ];

  private themeWrap: HTMLDivElement | null = null;
  private contentHost: HTMLDivElement | null = null;
  private copilotCtx: CopilotRenderContext | undefined;
  private settingsCtx: SettingsRenderContext | undefined;
  private fundingGateCtx: FundingGateContext | undefined;

  connectedCallback(): void {
    ensureAccountBridgeTheme();
    void this.mount();
  }

  disconnectedCallback(): void {
    this.teardownContent();
    teardownBridge(this);
  }

  attributeChangedCallback(): void {
    if (this.isConnected) {
      this.teardownContent();
      teardownBridge(this);
      void this.mount();
    }
  }

  private teardownContent(): void {
    unmountCopilotView(this.copilotCtx);
    unmountSettingsView(this.settingsCtx);
    unmountFundingGate(this.fundingGateCtx);
    this.copilotCtx = undefined;
    this.settingsCtx = undefined;
    this.fundingGateCtx = undefined;
  }

  private async mount(): Promise<void> {
    const config = configFromElement(this);
    const providerId = (this.getAttribute('provider-id') as ProviderId | null) ?? config.copilotProviderId;
    const defaults = copilotDefaultsForProvider(providerId ?? undefined);
    const streamAttr = this.getAttribute('stream');
    const stream =
      streamAttr === 'false' || streamAttr === '0'
        ? false
        : streamAttr === 'true' || streamAttr === '1'
          ? true
          : defaults.stream;

    const bridge = await bridgeForElement(this);
    this.ensureBridgeSubscription(bridge, () => void this.renderContent());

    this.themeWrap = document.createElement('div');
    this.themeWrap.className = themeClassFor(config.theme);
    this.contentHost = document.createElement('div');
    this.themeWrap.appendChild(this.contentHost);
    this.replaceChildren(this.themeWrap);

    await this.renderContent(providerId, defaults, stream);
  }

  private ensureBridgeSubscription(bridge: AccountBridge, onChange: () => void): void {
    const host = this as BridgeHost;
    if (host[BRIDGE_UNSUB_KEY]) return;
    host[BRIDGE_UNSUB_KEY] = bridge.subscribe((event) => {
      if (event.type === 'connect' || event.type === 'disconnect') {
        onChange();
      }
    });
  }

  private async renderContent(
    providerId?: ProviderId | null,
    defaults = copilotDefaultsForProvider(providerId ?? undefined),
    stream = defaults.stream,
  ): Promise<void> {
    if (!this.contentHost) return;

    const config = configFromElement(this);
    const getAuthHeaders = async () => resolveAuthHeaders(this, config);
    const resolvedProviderId =
      providerId ??
      ((this.getAttribute('provider-id') as ProviderId | null) ?? config.copilotProviderId);
    const bridge = await bridgeForElement(this);
    const ready = await embedFundingReady(
      bridge,
      config,
      getAuthHeaders,
      resolvedProviderId ?? undefined,
    );

    unmountCopilotView(this.copilotCtx);
    unmountSettingsView(this.settingsCtx);
    unmountFundingGate(this.fundingGateCtx);
    this.copilotCtx = undefined;
    this.settingsCtx = undefined;
    this.fundingGateCtx = undefined;
    this.contentHost.replaceChildren();

    if (!ready) {
      const gateHost = document.createElement('div');
      this.contentHost.appendChild(gateHost);
      this.fundingGateCtx = mountFundingGate(gateHost, {
        bridge,
        config,
        getAuthHeaders,
        providerIds: providerIdsFor(this),
        compact: true,
      });
      return;
    }

    const controller = createCopilotController({
      bridge,
      providerId: resolvedProviderId ?? undefined,
      title: this.getAttribute('title') ?? config.copilotTitle ?? defaults.title,
      subtitle: this.getAttribute('subtitle') ?? config.copilotSubtitle ?? defaults.subtitle,
      stream,
    });
    this.copilotCtx = mountCopilotView(this.contentHost, controller, {
      suggestedPrompts: defaults.suggestedPrompts,
    });
  }
}

export class AccountBridgeEmbedElement extends HTMLElement {
  static observedAttributes = ['app-id', 'mode', 'transport', 'theme', 'copilot-provider-id'];

  private themeWrap: HTMLDivElement | null = null;
  private settingsHost: HTMLDivElement | null = null;
  private copilotHost: HTMLDivElement | null = null;
  private settingsCtx: SettingsRenderContext | undefined;
  private copilotCtx: CopilotRenderContext | undefined;
  private fundingGateCtx: FundingGateContext | undefined;

  connectedCallback(): void {
    ensureAccountBridgeTheme();
    void this.mount();
  }

  disconnectedCallback(): void {
    unmountSettingsView(this.settingsCtx);
    unmountCopilotView(this.copilotCtx);
    unmountFundingGate(this.fundingGateCtx);
    this.settingsCtx = undefined;
    this.copilotCtx = undefined;
    this.fundingGateCtx = undefined;
    this.themeWrap = null;
    this.settingsHost = null;
    this.copilotHost = null;
    teardownBridge(this);
  }

  attributeChangedCallback(): void {
    if (this.isConnected) {
      unmountSettingsView(this.settingsCtx);
      unmountCopilotView(this.copilotCtx);
      this.settingsCtx = undefined;
      this.copilotCtx = undefined;
      teardownBridge(this);
      void this.mount();
    }
  }

  private async mount(): Promise<void> {
    const config = configFromElement(this);
    const mode = embedMode(this);
    const bridge = await bridgeForElement(this);

    this.ensureBridgeSubscription(bridge);

    this.themeWrap = document.createElement('div');
    this.themeWrap.className = ['ab-embed', themeClassFor(config.theme)].filter(Boolean).join(' ');

    if (mode === 'settings' || mode === 'full' || mode === 'gate' || mode === 'panel') {
      const section = document.createElement('section');
      section.className = 'ab-embed__section';
      section.innerHTML = `<h2 class="ab-embed__heading">Account</h2>
        <p class="ab-embed__lede">Connect once—use AI anywhere in this app.</p>`;
      this.settingsHost = document.createElement('div');
      section.appendChild(this.settingsHost);
      this.themeWrap.appendChild(section);

      const controller = createSettingsController({
        bridge,
        providerIds: providerIdsFor(this),
        getOAuthStartUrl: (key) => oauthStartUrlFor(config, key),
      });
      this.settingsCtx = mountSettingsView(this.settingsHost, controller, config.compact);
    }

    if (mode === 'copilot' || mode === 'full' || mode === 'panel') {
      const section = document.createElement('section');
      section.className = 'ab-embed__section';
      section.innerHTML = `<h2 class="ab-embed__heading">${mode === 'full' ? 'Try it' : 'Copilot'}</h2>`;
      this.copilotHost = document.createElement('div');
      section.appendChild(this.copilotHost);
      this.themeWrap.appendChild(section);
      await this.mountCopilotSection();
    }

    this.replaceChildren(this.themeWrap);
  }

  private ensureBridgeSubscription(bridge: AccountBridge): void {
    const host = this as BridgeHost;
    if (host[BRIDGE_UNSUB_KEY]) return;
    host[BRIDGE_UNSUB_KEY] = bridge.subscribe((event) => {
      if (event.type === 'connect' || event.type === 'disconnect') {
        void this.mountCopilotSection();
      }
    });
  }

  private async mountCopilotSection(): Promise<void> {
    if (!this.copilotHost) return;

    const config = configFromElement(this);
    const getAuthHeaders = async () => resolveAuthHeaders(this, config);
    const providerId =
      (this.getAttribute('copilot-provider-id') as ProviderId | null) ?? config.copilotProviderId;
    const defaults = copilotDefaultsForProvider(providerId ?? undefined);
    const bridge = await bridgeForElement(this);
    const ready = await embedFundingReady(bridge, config, getAuthHeaders, providerId ?? undefined);

    unmountCopilotView(this.copilotCtx);
    unmountFundingGate(this.fundingGateCtx);
    this.copilotCtx = undefined;
    this.fundingGateCtx = undefined;
    this.copilotHost.replaceChildren();

    if (!ready) {
      this.fundingGateCtx = mountFundingGate(this.copilotHost, {
        bridge,
        config,
        getAuthHeaders,
        providerIds: providerIdsFor(this),
        compact: true,
      });
      return;
    }

    const controller = createCopilotController({
      bridge,
      providerId: providerId ?? undefined,
      title: config.copilotTitle ?? defaults.title,
      subtitle: config.copilotSubtitle ?? defaults.subtitle,
      stream: defaults.stream,
    });
    this.copilotCtx = mountCopilotView(this.copilotHost, controller, {
      suggestedPrompts: defaults.suggestedPrompts,
    });
  }
}

export function registerAccountBridgeElements(): void {
  if (!customElements.get('account-bridge-settings')) {
    customElements.define('account-bridge-settings', AccountBridgeSettingsElement);
  }
  if (!customElements.get('account-bridge-copilot')) {
    customElements.define('account-bridge-copilot', AccountBridgeCopilotElement);
  }
  if (!customElements.get('account-bridge-embed')) {
    customElements.define('account-bridge-embed', AccountBridgeEmbedElement);
  }
}
