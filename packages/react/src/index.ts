export { AccountBridgeProvider, useAccountBridge } from './context.js';
export type { AccountBridgeProviderProps } from './context.js';
export {
  useProviderConnected,
  useProviderList,
  useConsumerCreditsReady,
  useBridgeFundingReady,
  useAccountBridgeInstance,
  useConnectionSummary,
} from './hooks.js';
export type { ConnectionSummary } from './hooks.js';
export { useSettingsController } from './useSettingsController.js';
export type { UseSettingsControllerOptions, UseSettingsControllerResult } from './useSettingsController.js';
export { SettingsView } from './SettingsView.js';
export type { SettingsViewProps } from './SettingsView.js';
export { AccountBridgeEmbed } from './AccountBridgeEmbed.js';
export type { AccountBridgeEmbedProps, AccountBridgeEmbedMode } from './AccountBridgeEmbed.js';
export type { AccountBridgeEmbedConfig } from '@account-bridge/ui';
export { AccountBridgeTheme } from './AccountBridgeTheme.js';
export type { AccountBridgeThemeProps, AccountBridgeThemeMode, AccountBridgeThemeSetting } from './AccountBridgeTheme.js';
export { useResolvedThemeMode } from './useResolvedThemeMode.js';
export { ProviderIcon } from './ProviderIcon.js';
export type { ProviderIconProps } from './ProviderIcon.js';
export { useCopilot } from './useCopilot.js';
export type { UseCopilotOptions, UseCopilotResult } from './useCopilot.js';
export { CopilotView } from './CopilotView.js';
export type { CopilotViewProps } from './CopilotView.js';
export { AccountBridgeCopilot } from './AccountBridgeCopilot.js';
export type { AccountBridgeCopilotProps } from './AccountBridgeCopilot.js';
export { AccountBridgeCopilotPanel } from './AccountBridgeCopilotPanel.js';
export type { AccountBridgeCopilotPanelProps } from './AccountBridgeCopilotPanel.js';
export {
  FeatureGate,
  ConnectProviderForm,
  ProviderStatusBadge,
  ConnectedProvidersList,
  AccountBridgeSettings,
  ConsumerCreditGate,
  ConsumerFundingGate,
} from './components.js';
export type {
  FeatureGateProps,
  ConnectProviderFormProps,
  ProviderStatusBadgeProps,
  ConnectedProvidersListProps,
  ConsumerCreditGateProps,
  ConsumerFundingGateProps,
} from './components.js';
export { WalletView, useWalletController } from './WalletView.js';
export type { WalletViewProps } from './WalletView.js';
export type { AccountBridgeSettingsProps } from './AccountBridgeSettings.js';
export {
  DEFAULT_HOST_PROVIDER_IDS,
  buildOAuthStartUrl,
  defaultOAuthBasePath,
  resolveHostProviders,
  scopeBridgeUserId,
  createBrowserHostBridge,
  createLocalAccountBridge,
  type HostBridgeConfig,
} from '@account-bridge/core';
export {
  shadcnPreset,
  headlessPreset,
  headlessCssVariables,
  mergeClassNames,
  shadcnCopilotPreset,
  headlessCopilotPreset,
  mergeCopilotClassNames,
  createSettingsController,
  createCopilotController,
  accountBridgeThemeCss,
  DEFAULT_SUGGESTED_PROMPTS,
  MICROSOFT_COPILOT_SUGGESTED_PROMPTS,
  copilotDefaultsForProvider,
  friendlyCopilotError,
  COPILOT_COMPOSER_HINT,
  SETTINGS_ONBOARDING_STEPS,
  isRecommendedProvider,
} from '@account-bridge/ui';
export type {
  AccountBridgeClassNames,
  SettingsViewState,
  SettingsController,
  CopilotViewState,
  CopilotClassNames,
  CopilotController,
  CopilotConnectedProvider,
} from '@account-bridge/ui';
