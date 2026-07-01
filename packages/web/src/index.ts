export type {
  AccountBridgeEmbedConfig,
  AccountBridgeEmbedMode,
  AccountBridgeEmbedTransport,
  AccountBridgeThemeSetting,
  AuthHeadersRequestDetail,
} from './types.js';

export {
  AccountBridgeSettingsElement,
  AccountBridgeCopilotElement,
  AccountBridgeEmbedElement,
  registerAccountBridgeElements,
} from './elements.js';

export {
  configFromElement,
  createBridgeFromConfig,
  oauthStartUrlFor,
  resolveAuthHeaders,
} from './bootstrap.js';

export {
  isAccountBridgeEnabled,
  mountOptionalAccountBridge,
  type AccountBridgeElementTag,
  type MountOptionalAccountBridgeOptions,
  type OptionalAccountBridgeHandle,
  type OptionalFlagValue,
} from './optional.js';

export { ensureAccountBridgeTheme, themeClassFor, providerIconLabel } from './theme.js';

export {
  embedFundingReady,
  mountFundingGate,
  unmountFundingGate,
  type FundingGateContext,
} from './fundingGate.js';
export { mountSettingsView, unmountSettingsView } from './renderSettings.js';
export { mountCopilotView, unmountCopilotView } from './renderCopilot.js';

export { copilotDefaultsForProvider, accountBridgeThemeCss } from '@account-bridge/ui';
