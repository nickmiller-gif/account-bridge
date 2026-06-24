import type { AccountBridge, ProviderId, ProviderStatus } from '@account-bridge/core';
import { consumerCreditsReady } from '@account-bridge/core';

import { startOAuthNavigation } from './oauth.js';
import {
  DEFAULT_SETTINGS_PROVIDER_IDS,
  type ProviderCardViewModel,
  type SettingsViewState,
} from './types.js';

export interface SettingsControllerOptions {
  bridge: AccountBridge;
  providerIds?: ProviderId[];
  introTitle?: string;
  introDescription?: string;
  getOAuthStartUrl?: (oauthProviderKey: string) => string;
  onOAuthStart?: (providerId: ProviderId, oauthProviderKey: string) => void | Promise<void>;
  navigate?: (url: string) => void;
}

export class SettingsController {
  private readonly bridge: AccountBridge;
  private readonly providerIds: ProviderId[];
  private readonly introTitle: string;
  private readonly introDescription: string;
  private readonly getOAuthStartUrl?: (oauthProviderKey: string) => string;
  private readonly onOAuthStart?: (providerId: ProviderId, oauthProviderKey: string) => void | Promise<void>;
  private readonly navigate?: (url: string) => void;

  private providers: ProviderStatus[] | null = null;
  private defaultProvider: ProviderId | null = null;
  private loading = true;
  private expandedKey: ProviderId | null = null;
  private apiKeys: Record<string, string> = {};
  private errors: Record<string, string> = {};
  private busy: Record<string, boolean> = {};
  private testResults: Record<string, string> = {};
  private notice: string | null = null;
  private noticeTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly listeners = new Set<(state: SettingsViewState) => void>();
  private readonly unsubBridge: () => void;

  constructor(options: SettingsControllerOptions) {
    this.bridge = options.bridge;
    this.providerIds = options.providerIds ?? DEFAULT_SETTINGS_PROVIDER_IDS;
    this.introTitle = options.introTitle ?? 'Connect your AI account';
    this.introDescription =
      options.introDescription ??
      'Pick a provider you already use. Keys and sign-in tokens stay encrypted on your device—never shared with the app host.';
    this.getOAuthStartUrl = options.getOAuthStartUrl;
    this.onOAuthStart = options.onOAuthStart;
    this.navigate = options.navigate;

    this.unsubBridge = this.bridge.subscribe((event) => {
      if (event.type === 'preferences' || event.type === 'connect' || event.type === 'disconnect') {
        void this.refresh();
      }
    });

    void this.refresh();
  }

  getState(): SettingsViewState {
    return {
      loading: this.loading,
      providers: this.providers,
      defaultProvider: this.defaultProvider,
      introTitle: this.introTitle,
      introDescription: this.introDescription,
      providerIds: this.providerIds,
      cards: this.buildCards(),
      connectedOptions: this.buildConnectedOptions(),
      notice: this.notice,
    };
  }

  subscribe(listener: (state: SettingsViewState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  destroy(): void {
    if (this.noticeTimer) clearTimeout(this.noticeTimer);
    this.unsubBridge();
    this.listeners.clear();
  }

  clearNotice(): void {
    if (this.noticeTimer) {
      clearTimeout(this.noticeTimer);
      this.noticeTimer = null;
    }
    this.notice = null;
    this.emit();
  }

  private showNotice(message: string): void {
    if (this.noticeTimer) clearTimeout(this.noticeTimer);
    this.notice = message;
    this.emit();
    this.noticeTimer = setTimeout(() => {
      this.notice = null;
      this.noticeTimer = null;
      this.emit();
    }, 4000);
  }

  private labelFor(providerId: ProviderId): string {
    return this.bridge.getProviderDefinition(providerId)?.displayName ?? providerId;
  }

  private emit(): void {
    const state = this.getState();
    for (const listener of this.listeners) listener(state);
  }

  private statusFor(id: ProviderId): ProviderStatus | undefined {
    return this.providers?.find((p) => p.providerId === id);
  }

  private buildConnectedOptions(): Array<{ id: ProviderId; label: string }> {
    return this.providerIds
      .map((id) => {
        const st = this.statusFor(id);
        if (!st?.connected) return null;
        const def = this.bridge.getProviderDefinition(id);
        return { id, label: def?.displayName ?? id };
      })
      .filter((x): x is { id: ProviderId; label: string } => x !== null);
  }

  private buildCards(): ProviderCardViewModel[] {
    return this.providerIds.map((providerId) => {
      const definition = this.bridge.getProviderDefinition(providerId);
      const status = this.statusFor(providerId);
      const connected = status?.connected ?? false;
      return {
        providerId,
        displayName: definition?.displayName ?? providerId,
        connected,
        helpUrl: definition?.helpUrl,
        supportsOAuth: Boolean(definition?.supportsOAuth && definition.oauthProviderKey),
        supportsApiKey: definition?.supportsApiKey !== false,
        oauthProviderKey: definition?.oauthProviderKey,
        oauthButtonLabel:
          definition?.oauthButtonLabel ??
          (definition?.oauthProviderKey === 'microsoft'
            ? 'Connect with Microsoft'
            : definition?.oauthProviderKey === 'google'
              ? 'Connect with Google'
              : 'Connect with OAuth'),
        error: this.errors[providerId],
        busy: Boolean(this.busy[providerId]),
        testResult: this.testResults[providerId],
        keyFormExpanded: this.expandedKey === providerId,
        apiKeyValue: this.apiKeys[providerId] ?? '',
      };
    });
  }

  async refresh(): Promise<void> {
    this.loading = true;
    this.emit();
    try {
      this.providers = await this.bridge.listProviders();
      this.defaultProvider = await this.bridge.getDefaultProvider();
    } finally {
      this.loading = false;
      this.emit();
    }
  }

  setApiKey(providerId: ProviderId, value: string): void {
    this.apiKeys = { ...this.apiKeys, [providerId]: value };
    this.emit();
  }

  toggleKeyForm(providerId: ProviderId): void {
    this.expandedKey = this.expandedKey === providerId ? null : providerId;
    this.emit();
  }

  async connectWithApiKey(providerId: ProviderId): Promise<void> {
    const key = this.apiKeys[providerId]?.trim();
    if (!key) return;

    this.errors = { ...this.errors, [providerId]: '' };
    this.busy = { ...this.busy, [providerId]: true };
    this.emit();

    try {
      await this.bridge.connect(providerId, { kind: 'api_key', apiKey: key });
      this.apiKeys = { ...this.apiKeys, [providerId]: '' };
      this.expandedKey = null;
      this.showNotice(`${this.labelFor(providerId)} connected`);
      await this.refresh();
    } catch (err) {
      this.errors = {
        ...this.errors,
        [providerId]: err instanceof Error ? err.message : 'Connection failed',
      };
      this.emit();
    } finally {
      this.busy = { ...this.busy, [providerId]: false };
      this.emit();
    }
  }

  async disconnect(providerId: ProviderId): Promise<void> {
    const label = this.labelFor(providerId);
    await this.bridge.disconnect(providerId);
    this.testResults = { ...this.testResults, [providerId]: '' };
    this.showNotice(`${label} disconnected`);
    await this.refresh();
  }

  async testConnection(providerId: ProviderId): Promise<void> {
    this.testResults = { ...this.testResults, [providerId]: 'Testing…' };
    this.emit();
    try {
      const result = await this.bridge.validate(providerId);
      const message = result.message ?? 'Failed';
      if (!result.ok && message.toLowerCase().includes('reconnect')) {
        this.errors = { ...this.errors, [providerId]: message };
      } else {
        this.errors = { ...this.errors, [providerId]: '' };
      }
      this.testResults = {
        ...this.testResults,
        [providerId]: result.ok ? 'Connection OK' : message,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Not connected';
      if (message.toLowerCase().includes('reconnect')) {
        this.errors = { ...this.errors, [providerId]: message };
      }
      this.testResults = {
        ...this.testResults,
        [providerId]: message,
      };
    }
    this.emit();
  }

  async setDefaultProvider(providerId: ProviderId | null): Promise<void> {
    await this.bridge.setDefaultProvider(providerId);
    this.defaultProvider = providerId;
    this.emit();
  }

  async startOAuth(providerId: ProviderId, oauthProviderKey: string): Promise<void> {
    await startOAuthNavigation({
      providerId,
      oauthProviderKey,
      getOAuthStartUrl: this.getOAuthStartUrl,
      onOAuthStart: this.onOAuthStart,
      navigate: this.navigate,
    });
  }

  async isConsumerReady(providerId?: ProviderId): Promise<boolean> {
    return consumerCreditsReady(this.bridge, providerId);
  }
}

export function createSettingsController(options: SettingsControllerOptions): SettingsController {
  return new SettingsController(options);
}
