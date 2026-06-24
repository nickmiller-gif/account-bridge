import { randomBytes, createHash } from 'node:crypto';

import { refreshGoogleAccessToken, refreshMicrosoftAccessToken } from '@account-bridge/core';

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  /** Scopes for Generative Language API */
  scopes?: string[];
}

export interface MicrosoftOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  /** Entra tenant — `common`, `organizations`, or a tenant GUID */
  tenantId?: string;
  scopes?: string[];
}

export interface OAuthStateStore {
  set(state: string, payload: OAuthPendingState): Promise<void>;
  get(state: string): Promise<OAuthPendingState | null>;
  delete(state: string): Promise<void>;
}

export interface OAuthPendingState {
  userId: string;
  codeVerifier: string;
  providerKey: string;
  createdAt: number;
}

const DEFAULT_SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/generative-language',
];

export function generatePkcePair(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = randomBytes(32).toString('base64url');
  const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
  return { codeVerifier, codeChallenge };
}

export function buildGoogleOAuthStartUrl(
  config: GoogleOAuthConfig,
  state: string,
  codeChallenge: string,
): string {
  const scopes = (config.scopes ?? DEFAULT_SCOPES).join(' ');
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: scopes,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    access_type: 'offline',
    prompt: 'consent',
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeGoogleCode(
  config: GoogleOAuthConfig,
  code: string,
  codeVerifier: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ accessToken: string; refreshToken?: string; expiresIn?: number }> {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    code_verifier: codeVerifier,
    grant_type: 'authorization_code',
    redirect_uri: config.redirectUri,
  });
  const res = await fetchImpl('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Google token exchange failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}

export async function refreshGoogleToken(
  config: GoogleOAuthConfig,
  refreshToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ accessToken: string; expiresIn?: number }> {
  const result = await refreshGoogleAccessToken(
    { clientId: config.clientId, clientSecret: config.clientSecret },
    refreshToken,
    fetchImpl,
  );
  return { accessToken: result.accessToken, expiresIn: result.expiresIn };
}

/** In-memory OAuth state store for dev/single-node hosts */
export function memoryOAuthStateStore(ttlMs = 10 * 60 * 1000): OAuthStateStore {
  const map = new Map<string, OAuthPendingState>();
  return {
    async set(state, payload) {
      map.set(state, payload);
    },
    async get(state) {
      const row = map.get(state);
      if (!row) return null;
      if (Date.now() - row.createdAt > ttlMs) {
        map.delete(state);
        return null;
      }
      return row;
    },
    async delete(state) {
      map.delete(state);
    },
  };
}

const DEFAULT_MICROSOFT_SCOPES = [
  'openid',
  'profile',
  'offline_access',
  'Sites.Read.All',
  'Mail.Read',
  'People.Read.All',
  'OnlineMeetingTranscript.Read.All',
  'Chat.Read',
  'ChannelMessage.Read.All',
  'ExternalItem.Read.All',
];

export function buildMicrosoftOAuthStartUrl(
  config: MicrosoftOAuthConfig,
  state: string,
  codeChallenge: string,
): string {
  const tenant = config.tenantId ?? 'common';
  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: 'code',
    redirect_uri: config.redirectUri,
    response_mode: 'query',
    scope: (config.scopes ?? DEFAULT_MICROSOFT_SCOPES).join(' '),
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });
  return `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize?${params.toString()}`;
}

export async function exchangeMicrosoftCode(
  config: MicrosoftOAuthConfig,
  code: string,
  codeVerifier: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ accessToken: string; refreshToken?: string; expiresIn?: number }> {
  const tenant = config.tenantId ?? 'common';
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    code_verifier: codeVerifier,
    grant_type: 'authorization_code',
    redirect_uri: config.redirectUri,
  });
  const res = await fetchImpl(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Microsoft token exchange failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}

export async function refreshMicrosoftToken(
  config: MicrosoftOAuthConfig,
  refreshToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ accessToken: string; expiresIn?: number; refreshToken?: string }> {
  return refreshMicrosoftAccessToken(
    {
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      tenantId: config.tenantId,
    },
    refreshToken,
    fetchImpl,
  );
}

export interface MountOAuthRoutesOptions {
  basePath?: string;
  google?: GoogleOAuthConfig;
  microsoft?: MicrosoftOAuthConfig;
  stateStore: OAuthStateStore;
  resolveUser: (req: { headers: Record<string, string | string[] | undefined> }) => Promise<string | null> | string | null;
  onOAuthSuccess: (params: {
    userId: string;
    providerKey: string;
    credential: {
      kind: 'oauth';
      accessToken: string;
      refreshToken?: string;
      expiresAt?: string;
    };
  }) => Promise<void>;
}

export function createOAuthRouteHandlers(options: MountOAuthRoutesOptions) {
  const base = (options.basePath ?? '/account-bridge/oauth').replace(/\/$/, '');

  return {
    async handleStart(
      providerKey: string,
      userId: string,
    ): Promise<{ redirectUrl: string; state: string }> {
      const { codeVerifier, codeChallenge } = generatePkcePair();
      const state = randomBytes(16).toString('hex');
      await options.stateStore.set(state, {
        userId,
        codeVerifier,
        providerKey,
        createdAt: Date.now(),
      });

      if (providerKey === 'google') {
        if (!options.google) throw new Error('Google OAuth is not configured on this host');
        const redirectUrl = buildGoogleOAuthStartUrl(options.google, state, codeChallenge);
        return { redirectUrl, state };
      }

      if (providerKey === 'microsoft') {
        if (!options.microsoft) throw new Error('Microsoft OAuth is not configured on this host');
        const redirectUrl = buildMicrosoftOAuthStartUrl(options.microsoft, state, codeChallenge);
        return { redirectUrl, state };
      }

      throw new Error(`OAuth provider not supported: ${providerKey}`);
    },

    async handleCallback(query: URLSearchParams): Promise<{ userId: string; providerKey: string }> {
      const state = query.get('state');
      const code = query.get('code');
      const error = query.get('error');
      if (error) throw new Error(`OAuth denied: ${error}`);
      if (!state || !code) throw new Error('Missing OAuth state or code');

      const pending = await options.stateStore.get(state);
      if (!pending) throw new Error('Invalid or expired OAuth state');
      await options.stateStore.delete(state);

      let tokens: { accessToken: string; refreshToken?: string; expiresIn?: number };
      if (pending.providerKey === 'google') {
        if (!options.google) throw new Error('Google OAuth is not configured on this host');
        tokens = await exchangeGoogleCode(options.google, code, pending.codeVerifier);
      } else if (pending.providerKey === 'microsoft') {
        if (!options.microsoft) throw new Error('Microsoft OAuth is not configured on this host');
        tokens = await exchangeMicrosoftCode(options.microsoft, code, pending.codeVerifier);
      } else {
        throw new Error(`OAuth provider not supported: ${pending.providerKey}`);
      }

      const expiresAt =
        tokens.expiresIn !== undefined
          ? new Date(Date.now() + tokens.expiresIn * 1000).toISOString()
          : undefined;

      await options.onOAuthSuccess({
        userId: pending.userId,
        providerKey: pending.providerKey,
        credential: {
          kind: 'oauth',
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresAt,
        },
      });

      return { userId: pending.userId, providerKey: pending.providerKey };
    },

    basePath: base,
  };
}
