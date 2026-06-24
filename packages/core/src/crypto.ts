const IV_LENGTH = 12;
const TAG_LENGTH = 128;

function toBufferSource(bytes: Uint8Array): BufferSource {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export async function encryptPayload(
  plaintext: Uint8Array,
  keyMaterial: Uint8Array,
): Promise<Uint8Array> {
  const cryptoImpl = getCrypto();
  const iv = cryptoImpl.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await cryptoImpl.subtle.importKey(
    'raw',
    toBufferSource(keyMaterial),
    { name: 'AES-GCM' },
    false,
    ['encrypt'],
  );
  const ciphertext = await cryptoImpl.subtle.encrypt(
    { name: 'AES-GCM', iv, tagLength: TAG_LENGTH },
    key,
    toBufferSource(plaintext),
  );
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return combined;
}

export async function decryptPayload(
  encrypted: Uint8Array,
  keyMaterial: Uint8Array,
): Promise<Uint8Array> {
  if (encrypted.length <= IV_LENGTH) {
    throw new Error('Invalid encrypted payload');
  }
  const cryptoImpl = getCrypto();
  const iv = encrypted.slice(0, IV_LENGTH);
  const ciphertext = encrypted.slice(IV_LENGTH);
  const key = await cryptoImpl.subtle.importKey(
    'raw',
    toBufferSource(keyMaterial),
    { name: 'AES-GCM' },
    false,
    ['decrypt'],
  );
  const plaintext = await cryptoImpl.subtle.decrypt(
    { name: 'AES-GCM', iv, tagLength: TAG_LENGTH },
    key,
    ciphertext,
  );
  return new Uint8Array(plaintext);
}

export async function deriveKeyFromSecret(
  secret: string,
  salt: string,
): Promise<Uint8Array> {
  const cryptoImpl = getCrypto();
  const enc = new TextEncoder();
  const baseKey = await cryptoImpl.subtle.importKey(
    'raw',
    enc.encode(secret),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await cryptoImpl.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: enc.encode(salt),
      iterations: 100_000,
      hash: 'SHA-256',
    },
    baseKey,
    256,
  );
  return new Uint8Array(bits);
}

function getCrypto(): Crypto {
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.subtle) {
    return globalThis.crypto;
  }
  throw new Error('Web Crypto API is not available in this environment');
}

export function encodeJson(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value));
}

export function decodeJson<T>(bytes: Uint8Array): T {
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}
