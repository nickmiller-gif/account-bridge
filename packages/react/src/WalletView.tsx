import { useEffect, useState } from 'react';

import type { FundingPolicy } from '@account-bridge/core';
import { WalletController, type WalletViewState } from '@account-bridge/ui';

import type { WalletApiClient } from '@account-bridge/ui';

export interface WalletViewProps {
  controller: WalletController;
  className?: string;
}

export function WalletView({ controller, className }: WalletViewProps) {
  const [state, setState] = useState<WalletViewState>(controller.getState());

  useEffect(() => controller.subscribe(setState), [controller]);

  if (state.loading) {
    return <div className={className}>Loading credits…</div>;
  }

  if (!state.walletEnabled) {
    return (
      <div className={className}>
        <p>App credits are not enabled for this host.</p>
      </div>
    );
  }

  return (
    <div className={['ab-wallet', className].filter(Boolean).join(' ')}>
      <div className="ab-wallet__balance">
        <span className="ab-wallet__label">App credit balance</span>
        <strong className="ab-wallet__amount">{state.formattedBalance}</strong>
        <p className="ab-wallet__hint">Usage bills your balance—not the app developer.</p>
      </div>
      {state.error ? <p className="ab-wallet__error" role="alert">{state.error}</p> : null}
      <div className="ab-wallet__packs">
        {state.packs.map((pack) => (
          <button
            key={pack.id}
            type="button"
            className="ab-wallet__pack"
            disabled={state.busy}
            onClick={() => void controller.buyPack(pack.id)}
          >
            {pack.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function useWalletController(
  bridge: import('@account-bridge/core').AccountBridge,
  walletApi?: WalletApiClient,
  fundingPolicy?: FundingPolicy,
): WalletController {
  const [controller] = useState(
    () => new WalletController({ bridge, walletApi, fundingPolicy }),
  );
  return controller;
}
