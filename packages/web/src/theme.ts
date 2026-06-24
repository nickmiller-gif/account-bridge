import type { ProviderId } from '@account-bridge/core';
import { accountBridgeThemeCss } from '@account-bridge/ui';

const THEME_STYLE_ID = 'account-bridge-theme';

export function ensureAccountBridgeTheme(): void {
  if (typeof document === 'undefined') return;
  if (document.getElementById(THEME_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = THEME_STYLE_ID;
  style.textContent = accountBridgeThemeCss;
  document.head.appendChild(style);
}

export function themeClassFor(mode: 'light' | 'dark' | 'auto' | undefined): string {
  if (mode === 'light') return 'ab-theme ab-theme-light';
  if (mode === 'auto') {
    const prefersDark =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    return prefersDark ? 'ab-theme ab-theme-dark' : 'ab-theme ab-theme-light';
  }
  return 'ab-theme ab-theme-dark';
}

export function providerIconLabel(providerId: ProviderId): string {
  switch (providerId) {
    case 'openai':
      return 'AI';
    case 'anthropic':
      return 'Cl';
    case 'gemini':
      return 'Gm';
    case 'microsoft_copilot':
      return 'MS';
    case 'groq':
      return 'Gq';
    default:
      return providerId.slice(0, 2).toUpperCase();
  }
}
