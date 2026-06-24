import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';

import type { FundingPolicy, ProviderId } from '@account-bridge/core';
import { InvalidCredentialError } from '@account-bridge/core';
import {
  WalletController,
  consumerFundingReady,
  createWalletApiClient,
} from '@account-bridge/ui';

import { AccountBridgeSettings, type AccountBridgeSettingsProps } from './AccountBridgeSettings.js';
import { useAccountBridge } from './context.js';
import { useConsumerCreditsReady, useProviderConnected, useProviderList } from './hooks.js';
import { WalletView } from './WalletView.js';

export interface FeatureGateProps {
  provider: ProviderId;
  children: ReactNode;
  fallback?: ReactNode;
  loading?: ReactNode;
  className?: string;
}

export function FeatureGate({
  provider,
  children,
  fallback = null,
  loading = null,
  className,
}: FeatureGateProps) {
  const connected = useProviderConnected(provider);

  if (connected === null) {
    return loading ? <div className={className}>{loading}</div> : null;
  }

  if (!connected) {
    return fallback ? <div className={className}>{fallback}</div> : null;
  }

  return <div className={className}>{children}</div>;
}

export interface ConnectProviderFormProps {
  providerId: ProviderId;
  onConnected?: () => void;
  className?: string;
  inputClassName?: string;
  buttonClassName?: string;
  label?: string;
}

export function ConnectProviderForm({
  providerId,
  onConnected,
  className,
  inputClassName,
  buttonClassName,
  label,
}: ConnectProviderFormProps) {
  const bridge = useAccountBridge();
  const definition = bridge.getProviderDefinition(providerId);
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await bridge.connect(providerId, { kind: 'api_key', apiKey: apiKey.trim() });
      setApiKey('');
      onConnected?.();
    } catch (err: unknown) {
      if (err instanceof InvalidCredentialError) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : 'Connection failed');
      }
    } finally {
      setBusy(false);
    }
  };

  const displayName = definition?.displayName ?? providerId;

  return (
    <form className={className} onSubmit={(e) => void handleSubmit(e)}>
      <label>
        {label ?? `Connect ${displayName}`}
        <input
          type="password"
          autoComplete="off"
          placeholder="API key"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          className={inputClassName}
          disabled={busy}
        />
      </label>
      <button type="submit" disabled={busy || !apiKey.trim()} className={buttonClassName}>
        {busy ? 'Validating…' : 'Connect'}
      </button>
      {error ? <p role="alert">{error}</p> : null}
    </form>
  );
}

export interface ProviderStatusBadgeProps {
  providerId: ProviderId;
  className?: string;
  connectedClassName?: string;
  disconnectedClassName?: string;
}

export function ProviderStatusBadge({
  providerId,
  className,
  connectedClassName,
  disconnectedClassName,
}: ProviderStatusBadgeProps) {
  const bridge = useAccountBridge();
  const definition = bridge.getProviderDefinition(providerId);
  const connected = useProviderConnected(providerId);

  if (connected === null) return null;

  const name = definition?.displayName ?? providerId;
  const statusClass = connected ? connectedClassName : disconnectedClassName;

  return (
    <span className={[className, statusClass].filter(Boolean).join(' ')}>
      {name}: {connected ? 'Connected' : 'Not connected'}
    </span>
  );
}

export interface ConnectedProvidersListProps {
  className?: string;
  itemClassName?: string;
  onChange?: () => void;
}

export function ConnectedProvidersList({
  className,
  itemClassName,
  onChange,
}: ConnectedProvidersListProps) {
  const bridge = useAccountBridge();
  const providers = useProviderList();

  const handleDisconnect = async (providerId: ProviderId) => {
    await bridge.disconnect(providerId);
    onChange?.();
  };

  if (!providers) return null;

  return (
    <ul className={className}>
      {providers.map((p) => (
        <li key={p.providerId} className={itemClassName}>
          <ProviderStatusBadge providerId={p.providerId} />
          {p.connected ? (
            <button type="button" onClick={() => void handleDisconnect(p.providerId)}>
              Disconnect
            </button>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export interface ConsumerCreditGateProps {
  providerId?: ProviderId;
  children: ReactNode;
  loading?: ReactNode;
  className?: string;
  fallback?: ReactNode;
  settingsProps?: Omit<AccountBridgeSettingsProps, 'className'>;
  settingsClassName?: string;
}

export interface ConsumerFundingGateProps extends ConsumerCreditGateProps {
  fundingPolicy?: FundingPolicy;
  baseUrl?: string;
  apiPrefix?: string;
  getAuthHeaders?: () => Promise<Record<string, string>> | Record<string, string>;
}

export function ConsumerFundingGate({
  providerId,
  children,
  loading = null,
  className,
  fallback,
  settingsProps,
  settingsClassName,
  fundingPolicy = { mode: 'byok' },
  baseUrl,
  apiPrefix,
  getAuthHeaders,
}: ConsumerFundingGateProps) {
  const bridge = useAccountBridge();
  const byokReady = useConsumerCreditsReady(providerId);
  const [walletReady, setWalletReady] = useState<boolean | null>(null);
  const [settingsTab, setSettingsTab] = useState<'byok' | 'wallet'>('byok');

  const walletApi = useMemo(
    () =>
      baseUrl && getAuthHeaders
        ? createWalletApiClient({ baseUrl, apiPrefix, getAuthHeaders })
        : undefined,
    [baseUrl, apiPrefix, getAuthHeaders],
  );

  const walletController = useMemo(
    () => new WalletController({ bridge, walletApi, fundingPolicy }),
    [bridge, walletApi, fundingPolicy],
  );

  const refreshWalletReady = useCallback(async () => {
    if (!walletApi || fundingPolicy.mode === 'byok') {
      setWalletReady(false);
      return;
    }
    const balance = await walletApi.getBalance();
    const ready = await consumerFundingReady(bridge, fundingPolicy, balance.balanceMicrocredits);
    setWalletReady(ready);
    await walletController.refresh();
  }, [bridge, walletApi, fundingPolicy, walletController]);

  useEffect(() => {
    let cancelled = false;
    void refreshWalletReady().then(() => {
      if (cancelled) return;
    });
    return () => {
      cancelled = true;
    };
  }, [refreshWalletReady]);

  useEffect(() => {
    if (!walletApi || fundingPolicy.mode === 'byok') return;
    const onFocus = () => void refreshWalletReady();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [walletApi, fundingPolicy.mode, refreshWalletReady]);

  useEffect(() => {
    return bridge.subscribe((event) => {
      if (
        event.type === 'connect' ||
        event.type === 'disconnect' ||
        event.type === 'preferences'
      ) {
        void refreshWalletReady();
      }
    });
  }, [bridge, refreshWalletReady]);

  const ready =
    fundingPolicy.mode === 'byok'
      ? byokReady
      : fundingPolicy.mode === 'wallet'
        ? walletReady
        : byokReady === true || walletReady === true
          ? true
          : byokReady === null || walletReady === null
            ? null
            : false;

  if (ready === null) {
    return loading ? <div className={className}>{loading}</div> : null;
  }

  if (!ready) {
    if (fallback) {
      return <div className={className}>{fallback}</div>;
    }
    const showWallet = Boolean(fundingPolicy.wallet?.enabled) && fundingPolicy.mode !== 'byok';
    return (
      <div className={['ab-gate', className].filter(Boolean).join(' ')}>
        <div className="ab-gate__hero">
          <span className="ab-gate__icon" aria-hidden>
            ✦
          </span>
          <h3 className="ab-gate__title">Fund AI to continue</h3>
          <p className="ab-gate__text">
            Connect your own provider or add app credits—you stay in control of spend.
          </p>
        </div>
        {showWallet ? (
          <div className="ab-gate__tabs">
            <button
              type="button"
              className={settingsTab === 'byok' ? 'ab-gate__tab ab-gate__tab--active' : 'ab-gate__tab'}
              onClick={() => setSettingsTab('byok')}
            >
              My accounts
            </button>
            <button
              type="button"
              className={settingsTab === 'wallet' ? 'ab-gate__tab ab-gate__tab--active' : 'ab-gate__tab'}
              onClick={() => setSettingsTab('wallet')}
            >
              App credits
            </button>
          </div>
        ) : null}
        {settingsTab === 'wallet' && showWallet ? (
          <WalletView controller={walletController} />
        ) : (
          <AccountBridgeSettings className={settingsClassName} preset="headless" theme="dark" {...settingsProps} />
        )}
      </div>
    );
  }

  return <div className={className}>{children}</div>;
}

/** @deprecated Use ConsumerFundingGate */
export function ConsumerCreditGate(props: ConsumerCreditGateProps) {
  return <ConsumerFundingGate {...props} fundingPolicy={{ mode: 'byok' }} />;
}

export { AccountBridgeSettings, type AccountBridgeSettingsProps };
