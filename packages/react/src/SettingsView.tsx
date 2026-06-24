import type { ProviderId } from '@account-bridge/core';
import {
  headlessPreset,
  mergeClassNames,
  isRecommendedProvider,
  SETTINGS_ONBOARDING_STEPS,
  type AccountBridgeClassNames,
  type SettingsController,
  type SettingsViewState,
} from '@account-bridge/ui';

import { ProviderIcon } from './ProviderIcon.js';

export interface SettingsViewProps {
  state: SettingsViewState;
  controller: SettingsController;
  classNames?: Partial<AccountBridgeClassNames>;
  className?: string;
  cardClassName?: string;
}

function OnboardingSteps() {
  return (
    <div className="ab-settings__onboarding" aria-label="Getting started">
      <p className="ab-settings__onboarding-title">Get started in 3 steps</p>
      <ol className="ab-settings__onboarding-steps">
        {SETTINGS_ONBOARDING_STEPS.map((step) => (
          <li key={step.num} className="ab-settings__onboarding-step">
            <span className="ab-settings__onboarding-num" aria-hidden>
              {step.num}
            </span>
            <div className="ab-settings__onboarding-copy">
              <strong>{step.title}</strong>
              <span>{step.detail}</span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function SettingsView({
  state,
  controller,
  classNames: classNameOverrides,
  className,
  cardClassName,
}: SettingsViewProps) {
  const cn = mergeClassNames(headlessPreset, classNameOverrides);
  const connectedCount = state.cards.filter((c) => c.connected).length;

  if (state.loading && !state.providers) {
    return (
      <div className={[cn.root, cn.loading, className].filter(Boolean).join(' ')}>
        <div className={cn.loadingDots} aria-hidden>
          <span />
          <span />
          <span />
        </div>
        <span>Loading your providers…</span>
      </div>
    );
  }

  return (
    <div className={[cn.root, className].filter(Boolean).join(' ')}>
      <header className={cn.intro}>
        <h3 className={cn.introTitle}>{state.introTitle}</h3>
        <p className={cn.introDescription}>{state.introDescription}</p>
        <p className="ab-settings__trust" role="note">
          <span className="ab-settings__trust-icon" aria-hidden>
            ◆
          </span>
          Keys and tokens stay on your device. The host app never sees them.
        </p>
      </header>

      {state.notice ? (
        <p className="ab-settings__notice" role="status" aria-live="polite">
          {state.notice}
        </p>
      ) : null}

      {connectedCount === 0 ? <OnboardingSteps /> : null}

      {connectedCount > 0 ? (
        <div className="ab-settings__status-bar" role="status">
          <span className="ab-settings__status-dot" aria-hidden />
          <span className="ab-settings__status-text">
            {connectedCount} provider{connectedCount === 1 ? '' : 's'} ready
          </span>
          <div className="ab-settings__status-pills">
            {state.connectedOptions.map((opt) => (
              <span key={opt.id} className="ab-settings__status-pill">
                {opt.label}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {connectedCount > 0 ? (
        <div className={cn.defaultProviderCard}>
          <label className={cn.defaultProviderLabel}>
            Preferred provider
            <select
              className={cn.select}
              value={state.defaultProvider ?? ''}
              onChange={(e) => {
                const value = e.target.value as ProviderId | '';
                void controller.setDefaultProvider(value || null);
              }}
            >
              <option value="">Automatic — use any connected provider</option>
              {state.connectedOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      <div className="ab-settings__section">
        <div className="ab-settings__section-head">
          <h4 className="ab-settings__section-label">Providers</h4>
          <span className="ab-settings__section-meta">
            {connectedCount > 0
              ? `${connectedCount} connected`
              : 'Connect one to get started'}
          </span>
        </div>

        <div className={cn.providerGrid}>
          {state.cards.map((card) => (
            <article
              key={card.providerId}
              className={[
                cn.card,
                card.connected ? 'ab-settings__card--connected' : '',
                !card.connected && isRecommendedProvider(card.providerId)
                  ? 'ab-settings__card--recommended'
                  : '',
                cardClassName,
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <header className={cn.cardHeader}>
                <div className={cn.cardBrand}>
                  <ProviderIcon providerId={card.providerId} className={cn.cardIcon} />
                  <div className={cn.cardMeta}>
                    <strong className={cn.cardTitle}>
                      {card.displayName}
                      {!card.connected && isRecommendedProvider(card.providerId) ? (
                        <span className="ab-settings__recommended-badge">Recommended</span>
                      ) : null}
                    </strong>
                    <span
                      className={
                        card.connected ? cn.statusBadgeConnected : cn.statusBadgeDisconnected
                      }
                    >
                      {card.connected ? 'Ready to use' : 'Not connected yet'}
                    </span>
                  </div>
                </div>
              </header>

              {card.connected ? (
                <div className={cn.cardActions}>
                  {card.error ? (
                    <p className={cn.error} role="alert">
                      {card.error}
                    </p>
                  ) : null}
                  {card.supportsOAuth && card.oauthProviderKey && card.error?.toLowerCase().includes('reconnect') ? (
                    <button
                      type="button"
                      className={cn.buttonOAuth}
                      onClick={() => void controller.startOAuth(card.providerId, card.oauthProviderKey!)}
                    >
                      Reconnect
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className={cn.buttonSecondary}
                    onClick={() => void controller.testConnection(card.providerId)}
                  >
                    Test connection
                  </button>
                  <button
                    type="button"
                    className={cn.buttonSecondary}
                    onClick={() => void controller.disconnect(card.providerId)}
                  >
                    Disconnect
                  </button>
                  {card.testResult ? <span className={cn.muted}>{card.testResult}</span> : null}
                </div>
              ) : (
                <div className={cn.cardActionsColumn}>
                  <div className={cn.cardActions}>
                    {card.supportsOAuth && card.oauthProviderKey ? (
                      <button
                        type="button"
                        className={cn.buttonOAuth}
                        onClick={() => void controller.startOAuth(card.providerId, card.oauthProviderKey!)}
                      >
                        {card.oauthButtonLabel}
                      </button>
                    ) : null}

                    {card.supportsApiKey ? (
                      <button
                        type="button"
                        className={cn.buttonSecondary}
                        onClick={() => controller.toggleKeyForm(card.providerId)}
                      >
                        {card.keyFormExpanded ? 'Cancel' : card.supportsOAuth ? 'Use API key instead' : 'Connect with API key'}
                      </button>
                    ) : null}

                    {card.helpUrl ? (
                      <a className={cn.link} href={card.helpUrl} target="_blank" rel="noreferrer">
                        Where do I get a key?
                      </a>
                    ) : null}
                  </div>

                  {card.supportsApiKey && card.keyFormExpanded ? (
                    <div className={cn.keyForm}>
                      <input
                        type="password"
                        className={cn.input}
                        placeholder="Paste API key"
                        value={card.apiKeyValue}
                        onChange={(e) => controller.setApiKey(card.providerId, e.target.value)}
                        disabled={card.busy}
                        autoComplete="off"
                        aria-label={`${card.displayName} API key`}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && card.apiKeyValue.trim() && !card.busy) {
                            e.preventDefault();
                            void controller.connectWithApiKey(card.providerId);
                          }
                        }}
                      />
                      <button
                        type="button"
                        className={cn.button}
                        disabled={card.busy || !card.apiKeyValue.trim()}
                        onClick={() => void controller.connectWithApiKey(card.providerId)}
                      >
                        {card.busy ? 'Checking…' : 'Connect'}
                      </button>
                    </div>
                  ) : null}

                  {card.error ? (
                    <p className={cn.error} role="alert">
                      {card.error}
                    </p>
                  ) : null}
                </div>
              )}
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
