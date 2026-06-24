import type {
  AccountBridgeEmbedConfig as SharedConfig,
  AccountBridgeEmbedMode,
  AccountBridgeEmbedTransport,
  AccountBridgeThemeSetting,
} from '@account-bridge/ui';

/** Web element config extends shared embed config with demo auth attributes */
export interface AccountBridgeEmbedConfig extends SharedConfig {
  authToken?: string;
  authHeaderName?: string;
}

export type { AccountBridgeEmbedMode, AccountBridgeEmbedTransport, AccountBridgeThemeSetting };

export interface AuthHeadersRequestDetail {
  callback: (headers: Record<string, string>) => void;
}
