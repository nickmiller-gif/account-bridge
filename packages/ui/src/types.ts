import type { ProviderId, ProviderStatus } from '@account-bridge/core';

export const DEFAULT_SETTINGS_PROVIDER_IDS: ProviderId[] = ['openai', 'anthropic', 'gemini'];

/** Semantic class names — map to Tailwind/shadcn or your design system */
export interface AccountBridgeClassNames {
  root: string;
  intro: string;
  introTitle: string;
  introDescription: string;
  defaultProviderRow: string;
  defaultProviderLabel: string;
  select: string;
  providerGrid: string;
  card: string;
  cardHeader: string;
  cardTitle: string;
  cardStatus: string;
  cardStatusConnected: string;
  cardStatusDisconnected: string;
  cardActions: string;
  cardActionsColumn: string;
  button: string;
  buttonSecondary: string;
  buttonOAuth: string;
  input: string;
  link: string;
  error: string;
  muted: string;
  keyForm: string;
  cardBrand: string;
  cardIcon: string;
  cardMeta: string;
  statusBadge: string;
  statusBadgeConnected: string;
  statusBadgeDisconnected: string;
  defaultProviderCard: string;
  loading: string;
  loadingDots: string;
}

export interface ProviderCardViewModel {
  providerId: ProviderId;
  displayName: string;
  connected: boolean;
  helpUrl?: string;
  supportsOAuth: boolean;
  supportsApiKey: boolean;
  oauthProviderKey?: string;
  oauthButtonLabel: string;
  error?: string;
  busy: boolean;
  testResult?: string;
  keyFormExpanded: boolean;
  apiKeyValue: string;
}

export interface SettingsViewState {
  loading: boolean;
  providers: ProviderStatus[] | null;
  defaultProvider: ProviderId | null;
  introTitle: string;
  introDescription: string;
  providerIds: ProviderId[];
  cards: ProviderCardViewModel[];
  connectedOptions: Array<{ id: ProviderId; label: string }>;
  /** Short-lived success/info message after connect/disconnect */
  notice: string | null;
}
