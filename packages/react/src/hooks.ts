import { useCallback, useEffect, useMemo, useState } from 'react';

import { consumerCreditsReady, type ProviderId } from '@account-bridge/core';
import { bridgeFundingReady } from '@account-bridge/ui';

import { useAccountBridge } from './context.js';

export function useProviderConnected(providerId: ProviderId): boolean | null {
  const bridge = useAccountBridge();
  const [connected, setConnected] = useState<boolean | null>(null);

  const refresh = useCallback(async () => {
    setConnected(await bridge.has(providerId));
  }, [bridge, providerId]);

  useEffect(() => {
    void refresh();
    return bridge.subscribe((event) => {
      if (event.type === 'preferences' || event.providerId === providerId) void refresh();
    });
  }, [bridge, providerId, refresh]);

  return connected;
}

export function useProviderList(): import('@account-bridge/core').ProviderStatus[] | null {
  const bridge = useAccountBridge();
  const [providers, setProviders] = useState<import('@account-bridge/core').ProviderStatus[] | null>(null);

  const refresh = useCallback(async () => {
    setProviders(await bridge.listProviders());
  }, [bridge]);

  useEffect(() => {
    void refresh();
    return bridge.subscribe(() => {
      void refresh();
    });
  }, [bridge, refresh]);

  return providers;
}

/** True when consumer has connected credentials required for AI features. */
export function useConsumerCreditsReady(providerId?: ProviderId): boolean | null {
  const bridge = useAccountBridge();
  const [ready, setReady] = useState<boolean | null>(null);

  const refresh = useCallback(async () => {
    setReady(await consumerCreditsReady(bridge, providerId));
  }, [bridge, providerId]);

  useEffect(() => {
    void refresh();
    return bridge.subscribe(() => {
      void refresh();
    });
  }, [bridge, refresh]);

  return ready;
}

/** True when BYOK and/or wallet funding is ready (remote hosts with getFundingStatus). */
export function useBridgeFundingReady(providerId?: ProviderId): boolean | null {
  const bridge = useAccountBridge();
  const [ready, setReady] = useState<boolean | null>(null);

  const refresh = useCallback(async () => {
    if (bridge.getFundingStatus) {
      setReady(await bridgeFundingReady(bridge, providerId));
      return;
    }
    setReady(await consumerCreditsReady(bridge, providerId));
  }, [bridge, providerId]);

  useEffect(() => {
    void refresh();
    return bridge.subscribe(() => {
      void refresh();
    });
  }, [bridge, refresh]);

  return ready;
}

export function useAccountBridgeInstance() {
  return useAccountBridge();
}

export interface ConnectionSummary {
  ready: boolean | null;
  count: number;
  connected: Array<{ id: ProviderId; label: string }>;
}

/** Connected provider summary for host nav badges and settings links. */
export function useConnectionSummary(): ConnectionSummary {
  const bridge = useAccountBridge();
  const providers = useProviderList();
  const ready = useBridgeFundingReady();

  const connected = useMemo(() => {
    if (!providers) return [];
    return providers
      .filter((p) => p.connected)
      .map((p) => {
        const def = bridge.getProviderDefinition(p.providerId);
        return { id: p.providerId, label: def?.displayName ?? p.providerId };
      });
  }, [bridge, providers]);

  return { ready, count: connected.length, connected };
}
