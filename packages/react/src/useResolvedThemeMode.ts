import { useEffect, useState } from 'react';

export type AccountBridgeThemeMode = 'light' | 'dark';
export type AccountBridgeThemeSetting = AccountBridgeThemeMode | 'auto';

function readSystemTheme(): AccountBridgeThemeMode {
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** Resolves `auto` to the OS light/dark preference. */
export function useResolvedThemeMode(
  mode: AccountBridgeThemeSetting = 'dark',
): AccountBridgeThemeMode {
  const [resolved, setResolved] = useState<AccountBridgeThemeMode>(() =>
    mode === 'auto' ? readSystemTheme() : mode,
  );

  useEffect(() => {
    if (mode !== 'auto') {
      setResolved(mode);
      return;
    }

    setResolved(readSystemTheme());
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setResolved(readSystemTheme());
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [mode]);

  return resolved;
}
