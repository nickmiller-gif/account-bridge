export {
  createAccountBridge,
  requireProvider,
  FeatureLockedError,
} from './bridge.js';
export {
  assertConsumerCreditsReady,
  assertHostSessionToken,
  assertNoInlineProviderKey,
  consumerCreditsReady,
  looksLikeProviderApiKey,
} from './consumerCredits.js';
export { createHostBridgeClient, type HostBridgeClientOptions } from './hostClient.js';
export {
  DEFAULT_HOST_PROVIDER_IDS,
  buildOAuthStartUrl,
  defaultOAuthBasePath,
  resolveHostProviders,
  resolveHostProviderIds,
  scopeBridgeUserId,
  type HostBridgeConfig,
  type ServerHostBridgeConfig,
  type ResolveHostProvidersOptions,
} from './hostConfig.js';
export {
  createBrowserHostBridge,
  createLocalAccountBridge,
  type LocalAccountBridgeConfig,
} from './createHostBridge.js';
export { createDefaultProviders, createProviderRegistry, type ProviderRegistry, type ProviderRegistryOptions } from './registry.js';
export {
  AccountBridgeError,
  ConsumerCreditsRequiredError,
  ConsumerFundingRequiredError,
  InvalidCredentialError,
  NotConnectedError,
  ProviderUnavailableError,
  StorageError,
} from './errors.js';
export {
  apiKeyCredentialSchema,
  oauthCredentialSchema,
  storedCredentialSchema,
  normalizeStoredCredential,
  authKindOf,
  resolveApiKey,
  resolveDefaultModel,
} from './credentials.js';
export { openaiProvider, openAiCredentialSchema, type OpenAiCredentials } from './providers/openai.js';
export {
  anthropicProvider,
  anthropicCredentialSchema,
  type AnthropicCredentials,
} from './providers/anthropic.js';
export {
  geminiProvider,
  geminiCredentialSchema,
  type GeminiCredentials,
} from './providers/gemini.js';
export {
  microsoftCopilotProvider,
  microsoftCopilotCredentialSchema,
  MICROSOFT_COPILOT_OAUTH_SCOPES,
  type MicrosoftCopilotCredentials,
  type MicrosoftCopilotRequestExtras,
} from './providers/microsoftCopilot.js';
export {
  createOpenAICompatibleProvider,
  type OpenAICompatibleConfig,
} from './providers/openaiCompatible.js';
export { memoryStorage } from './storage/memory.js';
export { deriveKeyFromSecret, encryptPayload, decryptPayload } from './crypto.js';
export {
  oauthExpiresSoon,
  refreshGoogleAccessToken,
  refreshMicrosoftAccessToken,
  refreshOAuthCredentialIfNeeded,
  providerUsesOAuth,
  type GoogleOAuthRefreshConfig,
  type MicrosoftOAuthRefreshConfig,
  type OAuthRefreshOptions,
} from './oauthRefresh.js';
export {
  DEFAULT_FUNDING_POLICY,
  getFundingPolicy,
  registerFundingPolicy,
  resolveFundingPolicy,
} from './fundingPolicy.js';
export { resolveFundingSource, type ResolvedFunding, type ResolveFundingSourceOptions } from './fundingResolver.js';
export { createHostKeyPool, type HostKeyPool, type HostKeyPoolOptions } from './hostKeyPool.js';
export { redactSensitive, safeJsonStringify } from './redact.js';
export type {
  AccountBridge,
  AccountBridgeOptions,
  AiProviderDefinition,
  AuthKind,
  BridgeChangeEvent,
  ChatClient,
  ChatCompletionOptions,
  ChatCompletionResult,
  ChatMessage,
  CredentialStore,
  EncryptionKeyMaterial,
  FileEncryptedStorageOptions,
  KnownProviderId,
  LocalEncryptedStorageOptions,
  ProviderId,
  ProviderStatus,
  StoredCredential,
  ApiKeyCredential,
  OAuthCredential,
  StoredCredentialRecord,
  UserPreferences,
  ValidationResult,
  ProviderCapabilities,
  FundingMode,
  FundingPolicy,
  FundingStatus,
  FundingPolicyWallet,
  FundingSourceKind,
  WalletBalance,
  WalletPricing,
  UsageRecord,
  LedgerEntry,
  WalletStore,
  WalletDebitParams,
  WalletCreditParams,
} from './types.js';
