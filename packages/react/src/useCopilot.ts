import { useEffect, useMemo, useState } from 'react';

import type { ProviderId } from '@account-bridge/core';
import {
  createCopilotController,
  type CopilotController,
  type CopilotControllerOptions,
  type CopilotViewState,
} from '@account-bridge/ui';

import { useAccountBridge } from './context.js';

export type UseCopilotOptions = Omit<CopilotControllerOptions, 'bridge'>;

export interface UseCopilotResult {
  state: CopilotViewState;
  controller: CopilotController;
}

export function useCopilot(options: UseCopilotOptions = {}): UseCopilotResult {
  const bridge = useAccountBridge();
  const controller = useMemo(
    () => createCopilotController({ bridge, ...options }),
    [
      bridge,
      options.providerId,
      options.systemPrompt,
      options.stream,
      options.maxTurns,
      options.title,
      options.subtitle,
    ],
  );

  const [state, setState] = useState<CopilotViewState>(() => controller.getState());

  useEffect(() => controller.subscribe(setState), [controller]);
  useEffect(() => () => controller.destroy(), [controller]);

  return { state, controller };
}

export type { CopilotViewState, CopilotControllerOptions, ProviderId };
