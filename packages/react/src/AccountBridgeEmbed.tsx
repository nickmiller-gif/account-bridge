import { useMemo, type ReactNode } from 'react';

import type { FundingPolicy, ProviderId } from '@account-bridge/core';
import {
  buildOAuthStartUrl,
  createBrowserHostBridge,
  createLocalAccountBridge,
  DEFAULT_HOST_PROVIDER_IDS,
  deriveKeyFromSecret,
  type HostBridgeConfig,
} from '@account-bridge/core';
import { copilotDefaultsForProvider } from '@account-bridge/ui';

import { AccountBridgeCopilot } from './AccountBridgeCopilot.js';
import { AccountBridgeCopilotPanel } from './AccountBridgeCopilotPanel.js';
import { AccountBridgeProvider } from './context.js';
import { AccountBridgeSettings } from './AccountBridgeSettings.js';
import { AccountBridgeTheme, type AccountBridgeThemeSetting } from './AccountBridgeTheme.js';
import { ConsumerFundingGate } from './components.js';

export type AccountBridgeEmbedMode = 'settings' | 'gate' | 'copilot' | 'panel' | 'full';

export interface AccountBridgeEmbedProps {
  /** Unique per host app — isolates consumer credentials (`centralr2-core`, `r2works`, …) */
  appId: string;
  /**
   * `local` — browser encrypted storage (demos, offline tools).
   * `remote` — host REST + gateway (production Lovable / custom backends).
   */
  transport?: 'local' | 'remote';
  /** Required when transport=`remote` */
  baseUrl?: string;
  getAuthHeaders?: HostBridgeConfig['getAuthHeaders'];
  apiPrefix?: string;
  oauthBasePath?: string;
  gatewayPath?: string;
  providerIds?: ProviderId[];
  includeMicrosoftCopilot?: boolean;
  includeCompatProviders?: boolean;
  mode?: AccountBridgeEmbedMode;
  preset?: 'headless' | 'shadcn';
  theme?: AccountBridgeThemeSetting;
  className?: string;
  /** Tighter settings cards — sidebars and FAB gate */
  compact?: boolean;
  /** Shown when mode is `gate` or `full` */
  children?: ReactNode;
  introTitle?: string;
  introDescription?: string;
  /** Local transport only */
  userId?: string;
  localPassphrase?: string;
  /** Lock copilot chat to one provider (e.g. `microsoft_copilot`) */
  copilotProviderId?: ProviderId;
  copilotTitle?: string;
  copilotSubtitle?: string;
  suggestedPrompts?: readonly string[];
  /** Consumer funding: byok | wallet | auto (remote hosts with wallet API) */
  fundingPolicy?: FundingPolicy;
  /** Platform SaaS publishable key (`ab_pk_…`) for hosted multi-tenant API */
  publishableKey?: string;
}

function useEmbedBridge(props: AccountBridgeEmbedProps) {
  const {
    appId,
    transport = 'local',
    baseUrl,
    getAuthHeaders,
    apiPrefix,
    oauthBasePath,
    gatewayPath,
    providerIds,
    includeMicrosoftCopilot,
    includeCompatProviders,
    userId,
    localPassphrase,
    publishableKey,
  } = props;

  return useMemo(() => {
    const providerOptions = {
      providerIds: providerIds ?? DEFAULT_HOST_PROVIDER_IDS,
      includeMicrosoftCopilot: includeMicrosoftCopilot ?? false,
      includeCompatProviders: includeCompatProviders ?? false,
    };

    if (transport === 'remote') {
      if (!baseUrl || !getAuthHeaders) {
        throw new Error('AccountBridgeEmbed remote transport requires baseUrl and getAuthHeaders');
      }
      return createBrowserHostBridge({
        appId,
        baseUrl,
        getAuthHeaders,
        apiPrefix,
        oauthBasePath,
        gatewayPath,
        publishableKey,
        ...providerOptions,
      });
    }

    const pass = localPassphrase ?? appId;
    return createLocalAccountBridge({
      appId,
      userId: userId ?? 'default',
      ...providerOptions,
      getEncryptionKey: async () => ({
        key: await deriveKeyFromSecret(pass, `${appId}:v1`),
      }),
    });
  }, [
    appId,
    transport,
    baseUrl,
    getAuthHeaders,
    apiPrefix,
    oauthBasePath,
    gatewayPath,
    providerIds,
    includeMicrosoftCopilot,
    includeCompatProviders,
    userId,
    localPassphrase,
    publishableKey,
  ]);
}

/**
 * Drop-in Account Bridge for any host app — settings, credit gate, copilot, or all.
 */
export function AccountBridgeEmbed(props: AccountBridgeEmbedProps) {
  const bridge = useEmbedBridge(props);
  const {
    mode = 'settings',
    transport = 'local',
    preset = 'headless',
    theme = 'dark',
    className,
    compact = false,
    children,
    introTitle,
    introDescription,
    oauthBasePath,
    apiPrefix,
    providerIds,
    includeMicrosoftCopilot,
    copilotProviderId,
    copilotTitle,
    copilotSubtitle,
    suggestedPrompts,
    fundingPolicy,
    baseUrl,
    getAuthHeaders,
  } = props;

  const resolvedFundingPolicy = fundingPolicy ?? { mode: 'byok' as const };

  const fundingGateProps = {
    fundingPolicy: resolvedFundingPolicy,
    baseUrl: transport === 'remote' ? baseUrl : undefined,
    getAuthHeaders: transport === 'remote' ? getAuthHeaders : undefined,
    apiPrefix,
  };

  const oauthStart = (key: string) => buildOAuthStartUrl(key, oauthBasePath, apiPrefix);
  const settingsProviderIds =
    providerIds ??
    (includeMicrosoftCopilot
      ? [...DEFAULT_HOST_PROVIDER_IDS, 'microsoft_copilot']
      : DEFAULT_HOST_PROVIDER_IDS);

  const copilotDefaults = copilotDefaultsForProvider(copilotProviderId);
  const resolvedCopilotTitle = copilotTitle ?? copilotDefaults.title;
  const resolvedCopilotSubtitle = copilotSubtitle ?? copilotDefaults.subtitle;
  const resolvedSuggestedPrompts = suggestedPrompts ?? copilotDefaults.suggestedPrompts;
  const copilotStream = copilotDefaults.stream;

  const settings = (
    <AccountBridgeSettings
      preset={preset}
      theme={theme}
      compact={compact}
      className={className}
      providerIds={settingsProviderIds}
      introTitle={introTitle}
      introDescription={introDescription}
      getOAuthStartUrl={oauthStart}
    />
  );

  const copilot = (
    <AccountBridgeCopilot
      preset={preset}
      theme={theme}
      stream={copilotStream}
      providerId={copilotProviderId}
      title={resolvedCopilotTitle}
      subtitle={resolvedCopilotSubtitle}
      suggestedPrompts={resolvedSuggestedPrompts}
    />
  );

  const gateSettingsProps = {
    preset,
    theme,
    providerIds: settingsProviderIds,
    getOAuthStartUrl: oauthStart,
    introTitle,
    introDescription,
  };

  let body: ReactNode;
  switch (mode) {
    case 'settings':
      body = settings;
      break;
    case 'gate':
      body = (
        <ConsumerFundingGate settingsProps={gateSettingsProps} {...fundingGateProps}>
          {children}
        </ConsumerFundingGate>
      );
      break;
    case 'copilot':
      body = (
        <ConsumerFundingGate settingsProps={gateSettingsProps} {...fundingGateProps}>
          {copilot}
        </ConsumerFundingGate>
      );
      break;
    case 'panel':
      body = (
        <>
          {children}
          <AccountBridgeCopilotPanel
            preset={preset}
            theme={theme}
            stream={copilotStream}
            providerId={copilotProviderId}
            title={resolvedCopilotTitle}
            panelTitle={resolvedCopilotTitle}
            subtitle={resolvedCopilotSubtitle}
            suggestedPrompts={resolvedSuggestedPrompts}
            fundingPolicy={resolvedFundingPolicy}
            baseUrl={transport === 'remote' ? baseUrl : undefined}
            getAuthHeaders={transport === 'remote' ? getAuthHeaders : undefined}
            apiPrefix={apiPrefix}
          />
        </>
      );
      break;
    case 'full':
    default:
      body = (
        <div className="ab-embed">
          <section className="ab-embed__section" aria-labelledby="ab-embed-settings">
            <h2 id="ab-embed-settings" className="ab-embed__heading">
              Account
            </h2>
            <p className="ab-embed__lede">
              {copilotProviderId === 'microsoft_copilot'
                ? 'Sign in with Microsoft to use Copilot in this app.'
                : 'Connect once—use AI anywhere in this app.'}
            </p>
            {settings}
          </section>
          <section className="ab-embed__section" aria-labelledby="ab-embed-chat">
            <h2 id="ab-embed-chat" className="ab-embed__heading">
              {copilotProviderId === 'microsoft_copilot' ? 'Copilot' : 'Try it'}
            </h2>
            <ConsumerFundingGate settingsProps={gateSettingsProps} {...fundingGateProps}>
              {copilot}
            </ConsumerFundingGate>
          </section>
          <AccountBridgeCopilotPanel
            preset={preset}
            theme={theme}
            stream={copilotStream}
            providerId={copilotProviderId}
            title={resolvedCopilotTitle}
            panelTitle={resolvedCopilotTitle}
            subtitle={resolvedCopilotSubtitle}
            suggestedPrompts={resolvedSuggestedPrompts}
            gateWithSettings={false}
            fundingPolicy={resolvedFundingPolicy}
            baseUrl={transport === 'remote' ? baseUrl : undefined}
            getAuthHeaders={transport === 'remote' ? getAuthHeaders : undefined}
            apiPrefix={apiPrefix}
          />
        </div>
      );
      break;
  }

  return (
    <AccountBridgeProvider bridge={bridge}>
      <AccountBridgeTheme mode={theme}>{body}</AccountBridgeTheme>
    </AccountBridgeProvider>
  );
}
