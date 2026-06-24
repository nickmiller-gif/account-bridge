import { useEffect, useMemo, useState } from 'react';

import type { ProviderId } from '@account-bridge/core';
import {
  createSettingsController,
  type SettingsController,
  type SettingsControllerOptions,
  type SettingsViewState,
} from '@account-bridge/ui';

import { useAccountBridge } from './context.js';

export type UseSettingsControllerOptions = Omit<SettingsControllerOptions, 'bridge'>;

export interface UseSettingsControllerResult {
  state: SettingsViewState;
  controller: SettingsController;
}

export function useSettingsController(options: UseSettingsControllerOptions = {}): UseSettingsControllerResult {
  const bridge = useAccountBridge();
  const controller = useMemo(
    () =>
      createSettingsController({
        bridge,
        navigate: typeof window !== 'undefined' ? (url) => { window.location.href = url; } : undefined,
        ...options,
      }),
    [
      bridge,
      options.providerIds,
      options.introTitle,
      options.introDescription,
      options.getOAuthStartUrl,
      options.onOAuthStart,
    ],
  );

  const [state, setState] = useState<SettingsViewState>(() => controller.getState());

  useEffect(() => {
    return controller.subscribe(setState);
  }, [controller]);

  useEffect(() => () => controller.destroy(), [controller]);

  return { state, controller };
}

export type { SettingsViewState, SettingsControllerOptions };
