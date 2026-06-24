import type { FundingPolicy, ProviderId } from '@account-bridge/core';

export type AccountBridgeEmbedMode = 'settings' | 'gate' | 'copilot' | 'panel' | 'full';
export type AccountBridgeEmbedTransport = 'local' | 'remote';
export type AccountBridgeThemeSetting = 'light' | 'dark' | 'auto';

/** Shared embed configuration for React and Web Components */
export interface AccountBridgeEmbedConfig {
  appId: string;
  transport?: AccountBridgeEmbedTransport;
  baseUrl?: string;
  apiPrefix?: string;
  oauthBasePath?: string;
  gatewayPath?: string;
  providerIds?: ProviderId[];
  includeMicrosoftCopilot?: boolean;
  includeCompatProviders?: boolean;
  mode?: AccountBridgeEmbedMode;
  theme?: AccountBridgeThemeSetting;
  compact?: boolean;
  userId?: string;
  localPassphrase?: string;
  copilotProviderId?: ProviderId;
  copilotTitle?: string;
  copilotSubtitle?: string;
  suggestedPrompts?: readonly string[];
  fundingPolicy?: FundingPolicy;
  walletApiBaseUrl?: string;
}
