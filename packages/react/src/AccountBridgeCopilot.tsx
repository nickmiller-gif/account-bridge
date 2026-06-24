import type { ProviderId } from '@account-bridge/core';
import type { CopilotClassNames } from '@account-bridge/ui';
import { shadcnCopilotPreset } from '@account-bridge/ui';

import { AccountBridgeTheme, type AccountBridgeThemeSetting } from './AccountBridgeTheme.js';
import { CopilotView } from './CopilotView.js';
import { useCopilot, type UseCopilotOptions } from './useCopilot.js';

export interface AccountBridgeCopilotProps extends UseCopilotOptions {
  className?: string;
  classNames?: Partial<CopilotClassNames>;
  preset?: 'headless' | 'shadcn';
  theme?: AccountBridgeThemeSetting;
  hideHeader?: boolean;
  placeholder?: string;
  sendLabel?: string;
  clearLabel?: string;
  regenerateLabel?: string;
  suggestedPrompts?: readonly string[];
}

export function AccountBridgeCopilot({
  className,
  classNames,
  preset = 'headless',
  theme = 'dark',
  hideHeader,
  placeholder,
  sendLabel,
  clearLabel,
  regenerateLabel,
  suggestedPrompts,
  ...controllerOptions
}: AccountBridgeCopilotProps) {
  const { state, controller } = useCopilot(controllerOptions);
  const resolvedClassNames =
    preset === 'shadcn' ? { ...shadcnCopilotPreset, ...classNames } : classNames;

  const view = (
    <CopilotView
      state={state}
      controller={controller}
      className={className}
      classNames={resolvedClassNames}
      hideHeader={hideHeader}
      placeholder={placeholder}
      sendLabel={sendLabel}
      clearLabel={clearLabel}
      regenerateLabel={regenerateLabel}
      suggestedPrompts={suggestedPrompts}
    />
  );

  if (preset === 'shadcn') {
    return view;
  }

  return <AccountBridgeTheme mode={theme}>{view}</AccountBridgeTheme>;
}

export type { ProviderId };
