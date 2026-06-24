import type { ProviderId } from '@account-bridge/core';

export interface OAuthNavigationOptions {
  oauthProviderKey: string;
  providerId: ProviderId;
  getOAuthStartUrl?: (oauthProviderKey: string) => string;
  onOAuthStart?: (providerId: ProviderId, oauthProviderKey: string) => void | Promise<void>;
  navigate?: (url: string) => void;
}

/** Start OAuth flow — host supplies URL builder or custom handler */
export async function startOAuthNavigation(options: OAuthNavigationOptions): Promise<void> {
  const { oauthProviderKey, providerId, getOAuthStartUrl, onOAuthStart, navigate } = options;

  if (onOAuthStart) {
    await onOAuthStart(providerId, oauthProviderKey);
    return;
  }

  if (getOAuthStartUrl) {
    const url = getOAuthStartUrl(oauthProviderKey);
    if (navigate) {
      navigate(url);
    }
  }
}

export function buildOAuthStartPath(
  oauthProviderKey: string,
  oauthBasePath?: string,
  apiPrefix?: string,
): string {
  const base = oauthBasePath ?? (apiPrefix ? `${apiPrefix.replace(/\/$/, '')}/oauth` : '/account-bridge/oauth');
  return `${base.replace(/\/$/, '')}/${oauthProviderKey}/start`;
}
