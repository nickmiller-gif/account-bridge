export type KnownProviderId =
  | 'openai'
  | 'anthropic'
  | 'gemini'
  | 'microsoft_copilot'
  | 'groq'
  | 'together'
  | 'mistral'
  | 'ollama';

/** Registered provider identifier (built-in or host-custom). */
export type ProviderId = string;

export type AuthKind = 'api_key' | 'oauth';

export type BridgeChangeEvent =
  | { type: 'connect'; providerId: ProviderId }
  | { type: 'disconnect'; providerId: ProviderId }
  | { type: 'preferences'; defaultProviderId: ProviderId | null };

export interface ValidationResult {
  ok: boolean;
  message?: string;
  metadata?: Record<string, unknown>;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatCompletionOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface ChatCompletionResult {
  content: string;
  model: string;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
  };
}

export interface ChatClient {
  complete(messages: ChatMessage[], options?: ChatCompletionOptions): Promise<ChatCompletionResult>;
  /** Optional streaming — yields text deltas when provider supports SSE */
  stream?(messages: ChatMessage[], options?: ChatCompletionOptions): AsyncGenerator<string, void, unknown>;
  /** Optional — reset provider-side conversation state (e.g. M365 Copilot thread) */
  resetConversation?(): void;
}

export interface ProviderStatus {
  providerId: ProviderId;
  connected: boolean;
  validatedAt?: string;
  label?: string;
  authKind?: AuthKind;
  defaultModel?: string;
}

export interface StoredCredentialRecord {
  providerId: ProviderId;
  encryptedPayload: Uint8Array;
  validatedAt: string;
  label?: string;
  authKind?: AuthKind;
  defaultModel?: string;
}

export interface UserPreferences {
  defaultProviderId: ProviderId | null;
}

export interface CredentialStore {
  get(userId: string, providerId: ProviderId): Promise<StoredCredentialRecord | null>;
  set(userId: string, record: StoredCredentialRecord): Promise<void>;
  delete(userId: string, providerId: ProviderId): Promise<void>;
  list(userId: string): Promise<ProviderStatus[]>;
  getPreferences?(userId: string): Promise<UserPreferences | null>;
  setPreferences?(userId: string, preferences: UserPreferences): Promise<void>;
}

export interface ProviderCapabilities {
  streaming?: boolean;
}

export interface AiProviderDefinition<TCredentials = Record<string, unknown>> {
  id: ProviderId;
  displayName: string;
  credentialSchema: import('zod').ZodType<TCredentials>;
  capabilities?: ProviderCapabilities;
  /** OAuth connect supported via server callback (host implements redirect). */
  supportsOAuth?: boolean;
  oauthProviderKey?: string;
  oauthButtonLabel?: string;
  /** When false, settings UI hides API-key connect (OAuth-only providers). Default true. */
  supportsApiKey?: boolean;
  helpUrl?: string;
  validate(credentials: TCredentials, fetchImpl?: typeof fetch): Promise<ValidationResult>;
  createChatClient(credentials: TCredentials, fetchImpl?: typeof fetch): ChatClient;
}

import type { OAuthRefreshOptions } from './oauthRefresh.js';

export interface AccountBridgeOptions {
  storage: CredentialStore;
  providers: AiProviderDefinition[];
  /** Derives AES-256 key for encrypting credentials at rest */
  getEncryptionKey: () => Promise<EncryptionKeyMaterial> | EncryptionKeyMaterial;
  /** Isolates credentials per host product when sharing storage (composite user key) */
  appId?: string;
  userId?: string;
  fetch?: typeof fetch;
  /** Server-side OAuth token refresh (Google Gemini + Microsoft Copilot) */
  oauthRefresh?: OAuthRefreshOptions;
}

export interface AccountBridge {
  connect(providerId: ProviderId, rawCredentials: unknown): Promise<ValidationResult>;
  disconnect(providerId: ProviderId): Promise<void>;
  has(providerId: ProviderId): Promise<boolean>;
  getClient(providerId: ProviderId): Promise<ChatClient>;
  /** Resolves default connected provider when providerId omitted */
  resolveClient(providerId?: ProviderId): Promise<{ client: ChatClient; providerId: ProviderId }>;
  validate(providerId: ProviderId): Promise<ValidationResult>;
  listProviders(): Promise<ProviderStatus[]>;
  getProviderDefinition(providerId: ProviderId): AiProviderDefinition | undefined;
  getDefaultProvider(): Promise<ProviderId | null>;
  setDefaultProvider(providerId: ProviderId | null): Promise<void>;
  /** Subscribe to connect/disconnect; returns unsubscribe fn */
  subscribe(listener: (event: BridgeChangeEvent) => void): () => void;
  /** Remote hosts: funding readiness including wallet (optional) */
  getFundingStatus?(): Promise<FundingStatus>;
}

export interface EncryptionKeyMaterial {
  /** Raw key bytes (32 bytes for AES-256-GCM) */
  key: Uint8Array;
}

export interface LocalEncryptedStorageOptions {
  namespace: string;
  /** IndexedDB database name override */
  dbName?: string;
}

export interface FileEncryptedStorageOptions {
  namespace: string;
  /** Directory for encrypted files; defaults to ~/.account-bridge */
  directory?: string;
}

/** How consumer AI usage is funded for a host app. */
export type FundingMode = 'byok' | 'wallet' | 'auto';

export interface WalletPricing {
  /** Microcredits charged per 1k input tokens */
  inputPer1kTokens?: number;
  /** Microcredits charged per 1k output tokens */
  outputPer1kTokens?: number;
  /** Flat microcredits per request when usage is unknown (streaming estimate fallback) */
  minPerRequest?: number;
}

export interface FundingPolicyWallet {
  enabled: boolean;
  /** Host path for Stripe webhook (informational; mount via billing routes) */
  stripeWebhookPath?: string;
}

export interface FundingStatus {
  ready: boolean;
  fundingPolicy: FundingPolicy;
  walletBalanceMicrocredits?: number;
  walletEnabled?: boolean;
  connectedCount: number;
  defaultProvider: ProviderId | null;
}

export interface FundingPolicy {
  /** Default funding mode for consumer AI surfaces */
  mode: FundingMode;
  pricing?: WalletPricing;
  wallet?: FundingPolicyWallet;
}

export type FundingSourceKind = 'byok' | 'wallet';

export interface WalletBalance {
  balanceMicrocredits: number;
  currency: string;
}

export interface UsageRecord {
  inputTokens?: number;
  outputTokens?: number;
  model?: string;
  providerId?: ProviderId;
}

export interface LedgerEntry {
  id: string;
  userId: string;
  appId: string;
  deltaMicrocredits: number;
  reason: string;
  usage?: UsageRecord;
  idempotencyKey?: string;
  createdAt: string;
}

export interface WalletDebitParams {
  userId: string;
  appId: string;
  usage: UsageRecord;
  idempotencyKey: string;
  pricing?: WalletPricing;
}

export interface WalletCreditParams {
  userId: string;
  appId: string;
  deltaMicrocredits: number;
  reason: string;
  idempotencyKey: string;
}

/** Wallet ledger — implemented by @account-bridge/billing */
export interface WalletStore {
  getBalance(userId: string, appId: string): Promise<WalletBalance>;
  assertSufficientBalance(
    userId: string,
    appId: string,
    estimatedMicrocredits: number,
  ): Promise<void>;
  debit(params: WalletDebitParams): Promise<LedgerEntry>;
  credit(params: WalletCreditParams): Promise<LedgerEntry>;
  listLedger(userId: string, appId: string, limit?: number): Promise<LedgerEntry[]>;
}

export type { StoredCredential, ApiKeyCredential, OAuthCredential } from './credentials.js';
