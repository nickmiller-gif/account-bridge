import type { ProviderId } from '@account-bridge/core';
import type { AccountBridgeClassNames } from '@account-bridge/ui';
import { shadcnPreset } from '@account-bridge/ui';

import { AccountBridgeTheme, type AccountBridgeThemeSetting } from './AccountBridgeTheme.js';
import { SettingsView } from './SettingsView.js';
import { useSettingsController, type UseSettingsControllerOptions } from './useSettingsController.js';

export interface AccountBridgeSettingsProps extends UseSettingsControllerOptions {
  className?: string;
  cardClassName?: string;
  classNames?: Partial<AccountBridgeClassNames>;
  /** shadcn requires Tailwind in the host app; headless uses bundled theme CSS */
  preset?: 'headless' | 'shadcn';
  /** Applied when preset="headless" (default dark) */
  theme?: AccountBridgeThemeSetting;
  /** Tighter layout — useful inside FAB panel or sidebars */
  compact?: boolean;
}

export function AccountBridgeSettings({
  className,
  cardClassName,
  classNames,
  preset = 'headless',
  theme = 'dark',
  compact = false,
  ...controllerOptions
}: AccountBridgeSettingsProps) {
  const { state, controller } = useSettingsController(controllerOptions);
  const resolvedClassNames =
    preset === 'shadcn' ? { ...shadcnPreset, ...classNames } : classNames;

  const view = (
    <SettingsView
      state={state}
      controller={controller}
      className={[className, compact ? 'ab-settings--compact' : ''].filter(Boolean).join(' ') || undefined}
      cardClassName={cardClassName}
      classNames={resolvedClassNames}
    />
  );

  if (preset === 'shadcn') {
    return view;
  }

  return <AccountBridgeTheme mode={theme}>{view}</AccountBridgeTheme>;
}

export type { ProviderId };
