import { describe, expect, it } from 'vitest';

import {
  generatePkcePair,
  buildGoogleOAuthStartUrl,
  buildMicrosoftOAuthStartUrl,
} from '../src/oauth.js';

describe('oauth pkce', () => {
  it('generates verifier and S256 challenge', () => {
    const { codeVerifier, codeChallenge } = generatePkcePair();
    expect(codeVerifier.length).toBeGreaterThan(20);
    expect(codeChallenge.length).toBeGreaterThan(20);
    expect(codeVerifier).not.toBe(codeChallenge);
  });

  it('builds Google OAuth start URL with PKCE params', () => {
    const url = buildGoogleOAuthStartUrl(
      {
        clientId: 'client-id',
        clientSecret: 'secret',
        redirectUri: 'http://localhost/callback',
      },
      'state-123',
      'challenge-abc',
    );
    expect(url).toContain('accounts.google.com');
    expect(url).toContain('code_challenge=challenge-abc');
    expect(url).toContain('state=state-123');
  });

  it('builds Microsoft OAuth start URL with PKCE params', () => {
    const url = buildMicrosoftOAuthStartUrl(
      {
        clientId: 'ms-client-id',
        clientSecret: 'secret',
        redirectUri: 'http://localhost/account-bridge/oauth/microsoft/callback',
        tenantId: 'common',
      },
      'state-ms',
      'challenge-ms',
    );
    expect(url).toContain('login.microsoftonline.com/common/oauth2/v2.0/authorize');
    expect(url).toContain('client_id=ms-client-id');
    expect(url).toContain('code_challenge=challenge-ms');
    expect(url).toContain('Sites.Read.All');
  });
});
