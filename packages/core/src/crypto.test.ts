import { describe, expect, it } from 'vitest';

import { decryptPayload, deriveKeyFromSecret, encryptPayload } from '../src/crypto.js';

describe('crypto', () => {
  it('round-trips encrypt/decrypt', async () => {
    const key = await deriveKeyFromSecret('test-secret', 'salt-ns');
    const plaintext = new TextEncoder().encode('hello credentials');
    const encrypted = await encryptPayload(plaintext, key);
    const decrypted = await decryptPayload(encrypted, key);
    expect(new TextDecoder().decode(decrypted)).toBe('hello credentials');
  });

  it('fails decrypt with wrong key', async () => {
    const key1 = await deriveKeyFromSecret('a', 'salt');
    const key2 = await deriveKeyFromSecret('b', 'salt');
    const encrypted = await encryptPayload(new TextEncoder().encode('x'), key1);
    await expect(decryptPayload(encrypted, key2)).rejects.toThrow();
  });
});
