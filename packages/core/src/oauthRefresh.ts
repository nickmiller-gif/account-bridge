import type { OAuthCredential } from './credentials.js';
import type { AiProviderDefinition, ProviderId } from './types.js';

export interface GoogleOAuthRefreshConfig {
  clientId: string;
  clientSecret: string;
}

export interface MicrosoftOAuthRefreshConfig {
  clientId: string;
  clientSecret: string;
  tenantId?: string;
}

export interface OAuthRefreshOptions {
  google?: GoogleOAuthRefreshConfig;
  microsoft?: MicrosoftOAuthRefreshConfig;
  /** Refresh if token expires within this many seconds (default 300) */
  skewSeconds?: number;
}

const DEFAULT_SKEW_SECONDS = 300;

export function oauthExpiresSoon(
  expiresAt: string | undefined,
  skewSeconds = DEFAULT_SKEW_SECONDS,
): boolean {
  if (!expiresAt) return false;
  const expiresMs = Date.parse(expiresAt);
  if (Number.isNaN(expiresMs)) return false;
  return expiresMs <= Date.now() + skewSeconds * 1000;
}

export async function refreshGoogleAccessToken(
  config: GoogleOAuthRefreshConfig,
  refreshToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ accessToken: string; expiresIn?: number }> {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });
  const res = await fetchImpl('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Google token refresh failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in?: number };
  return { accessToken: data.access_token, expiresIn: data.expires_in };
}

export async function refreshMicrosoftAccessToken(
  config: MicrosoftOAuthRefreshConfig,
  refreshToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ accessToken: string; expiresIn?: number; refreshToken?: string }> {
  const tenant = config.tenantId ?? 'common';
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  });
  const res = await fetchImpl(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Microsoft token refresh failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    access_token: string;
    expires_in?: number;
    refresh_token?: string;
  };
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
    refreshToken: data.refresh_token,
  };
}

function expiresAtFromSeconds(expiresIn?: number): string | undefined {
  if (expiresIn === undefined) return undefined;
  return new Date(Date.now() + expiresIn * 1000).toISOString();
}

export async function refreshOAuthCredentialIfNeeded(
  credential: OAuthCredential,
  provider: AiProviderDefinition,
  options: OAuthRefreshOptions | undefined,
  fetchImpl: typeof fetch = fetch,
): Promise<OAuthCredential> {
  if (!options) return credential;
  const skew = options.skewSeconds ?? DEFAULT_SKEW_SECONDS;
  if (!oauthExpiresSoon(credential.expiresAt, skew)) return credential;

  const refreshToken = credential.refreshToken;
  if (!refreshToken) {
    throw new Error('OAuth session expired — reconnect your account in settings');
  }

  const oauthKey = provider.oauthProviderKey;
  if (oauthKey === 'google') {
    if (!options.google) {
      throw new Error('Google OAuth refresh is not configured on this host');
    }
    const tokens = await refreshGoogleAccessToken(options.google, refreshToken, fetchImpl);
    return {
      ...credential,
      accessToken: tokens.accessToken,
      expiresAt: expiresAtFromSeconds(tokens.expiresIn) ?? credential.expiresAt,
    };
  }

  if (oauthKey === 'microsoft') {
    if (!options.microsoft) {
      throw new Error('Microsoft OAuth refresh is not configured on this host');
    }
    const tokens = await refreshMicrosoftAccessToken(options.microsoft, refreshToken, fetchImpl);
    return {
      ...credential,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken ?? credential.refreshToken,
      expiresAt: expiresAtFromSeconds(tokens.expiresIn) ?? credential.expiresAt,
    };
  }

  return credential;
}

export function providerUsesOAuth(provider: AiProviderDefinition): boolean {
  return Boolean(provider.supportsOAuth && provider.oauthProviderKey);
}

export type { ProviderId };
