import type { ReactNode } from 'react';

import {
  useResolvedThemeMode,
  type AccountBridgeThemeMode,
  type AccountBridgeThemeSetting,
} from './useResolvedThemeMode.js';

export type { AccountBridgeThemeMode, AccountBridgeThemeSetting };

export interface AccountBridgeThemeProps {
  children: ReactNode;
  mode?: AccountBridgeThemeSetting;
  className?: string;
}

/** Wrap headless Account Bridge UI so theme tokens apply. Import accountBridgeThemeCss once globally. */
export function AccountBridgeTheme({
  children,
  mode = 'dark',
  className,
}: AccountBridgeThemeProps) {
  const resolved = useResolvedThemeMode(mode);

  return (
    <div className={['ab-theme', `ab-theme-${resolved}`, className].filter(Boolean).join(' ')}>
      {children}
    </div>
  );
}
