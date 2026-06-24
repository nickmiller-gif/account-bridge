import { describe, expect, it } from 'vitest';

import { deriveKeyFromSecret } from '../crypto.js';
import {
  decryptCredentialsBrowser,
  encryptCredentialsBrowser,
} from './localEncrypted.js';

describe('browser credential helpers', () => {
  it('encrypts and decrypts credential payloads', async () => {
    const getKey = async () => ({
      key: await deriveKeyFromSecret('browser-test', 'ns'),
    });
    const creds = { apiKey: 'sk-test' };
    const encrypted = await encryptCredentialsBrowser(creds, getKey);
    const decrypted = await decryptCredentialsBrowser<{ apiKey: string }>(encrypted, getKey);
    expect(decrypted.apiKey).toBe('sk-test');
  });
});
