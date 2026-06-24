import { describe, expect, it, vi } from 'vitest';

import { createAccountBridge } from './bridge.js';
import { deriveKeyFromSecret } from './crypto.js';
import { oauthExpiresSoon, refreshOAuthCredentialIfNeeded } from './oauthRefresh.js';
import { microsoftCopilotProvider } from './providers/microsoftCopilot.js';
import { createDefaultProviders } from './registry.js';
import { memoryStorage } from './storage/memory.js';

const testKey = async () => ({ key: await deriveKeyFromSecret('oauth-refresh-test', 'ns') });

describe('oauthExpiresSoon', () => {
  it('returns true when expiry is within skew window', () => {
    const soon = new Date(Date.now() + 60_000).toISOString();
    expect(oauthExpiresSoon(soon, 300)).toBe(true);
  });

  it('returns false when expiry is far in the future', () => {
    const later = new Date(Date.now() + 3_600_000).toISOString();
    expect(oauthExpiresSoon(later, 300)).toBe(false);
  });
});

describe('refreshOAuthCredentialIfNeeded', () => {
  it('refreshes Microsoft token when expired', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'new-ms-token',
        expires_in: 3600,
        refresh_token: 'new-refresh',
      }),
    });

    const provider = microsoftCopilotProvider();
    const expired = new Date(Date.now() - 1000).toISOString();
    const refreshed = await refreshOAuthCredentialIfNeeded(
      {
        kind: 'oauth',
        accessToken: 'old-token',
        refreshToken: 'rt-123',
        expiresAt: expired,
      },
      provider,
      {
        microsoft: { clientId: 'cid', clientSecret: 'secret', tenantId: 'common' },
      },
      fetchImpl,
    );

    expect(refreshed.accessToken).toBe('new-ms-token');
    expect(refreshed.refreshToken).toBe('new-refresh');
    expect(refreshed.expiresAt).toBeTruthy();
  });
});

describe('createAccountBridge oauthRefresh', () => {
  it('auto-refreshes expired OAuth before getClient', async () => {
    const fetchImpl = vi.fn().mockImplementation(async (url: string) => {
      if (String(url).includes('oauth2/v2.0/token')) {
        return {
          ok: true,
          json: async () => ({ access_token: 'refreshed-ms', expires_in: 3600 }),
        };
      }
      if (String(url).includes('graph.microsoft.com/beta/copilot/conversations')) {
        if (String(url).includes('/chat')) {
          return {
            ok: true,
            json: async () => ({ id: 'c1', messages: [{ text: 'Hello from Copilot' }] }),
          };
        }
        return { ok: true, status: 201, json: async () => ({ id: 'c1' }) };
      }
      return { ok: false, status: 404, text: async () => 'not found' };
    });

    const bridge = createAccountBridge({
      storage: memoryStorage(),
      providers: createDefaultProviders({ includeMicrosoftCopilot: true }),
      getEncryptionKey: testKey,
      fetch: fetchImpl,
      oauthRefresh: {
        microsoft: { clientId: 'cid', clientSecret: 'secret' },
        skewSeconds: 300,
      },
    });

    const expired = new Date(Date.now() - 1000).toISOString();
    await bridge.connect('microsoft_copilot', {
      kind: 'oauth',
      accessToken: 'stale-token',
      refreshToken: 'rt-abc',
      expiresAt: expired,
    });

    const client = await bridge.getClient('microsoft_copilot');
    const reply = await client.complete([{ role: 'user', content: 'Hi' }]);
    expect(reply.content).toBe('Hello from Copilot');
    expect(fetchImpl).toHaveBeenCalledWith(
      expect.stringContaining('login.microsoftonline.com'),
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
