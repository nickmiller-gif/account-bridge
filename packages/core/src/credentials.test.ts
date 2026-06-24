import { describe, expect, it } from 'vitest';

import { authKindOf, normalizeStoredCredential } from '../src/credentials.js';

describe('normalizeStoredCredential', () => {
  it('migrates v1 api key blobs', () => {
    const cred = normalizeStoredCredential({ apiKey: 'sk-test' });
    expect(cred.kind).toBe('api_key');
    expect(authKindOf(cred)).toBe('api_key');
    if (cred.kind !== 'api_key') throw new Error('expected api_key');
    expect(cred.apiKey).toBe('sk-test');
  });

  it('accepts oauth credentials', () => {
    const cred = normalizeStoredCredential({
      kind: 'oauth',
      accessToken: 'ya29.test',
      refreshToken: 'rt',
    });
    expect(authKindOf(cred)).toBe('oauth');
  });
});
