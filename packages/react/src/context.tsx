import { createContext, useContext, type ReactNode } from 'react';

import type { AccountBridge } from '@account-bridge/core';

const AccountBridgeContext = createContext<AccountBridge | null>(null);

export interface AccountBridgeProviderProps {
  bridge: AccountBridge;
  children: ReactNode;
}

export function AccountBridgeProvider({ bridge, children }: AccountBridgeProviderProps) {
  return (
    <AccountBridgeContext.Provider value={bridge}>{children}</AccountBridgeContext.Provider>
  );
}

export function useAccountBridge(): AccountBridge {
  const bridge = useContext(AccountBridgeContext);
  if (!bridge) {
    throw new Error('useAccountBridge must be used within AccountBridgeProvider');
  }
  return bridge;
}
