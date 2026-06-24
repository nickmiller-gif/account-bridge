import { createHash, randomBytes } from 'node:crypto';

export function hashApiKey(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export function generateHostToken(): string {
  return `ab_host_${randomBytes(24).toString('base64url')}`;
}

export function generatePublishableKey(): string {
  return `ab_pk_${randomBytes(18).toString('base64url')}`;
}

export function generateSecretKey(): string {
  return `ab_sk_${randomBytes(24).toString('base64url')}`;
}

export function generateEncryptionSecret(): string {
  return randomBytes(32).toString('base64url');
}

export function newPlatformId(prefix: string): string {
  return `${prefix}_${Date.now()}_${randomBytes(4).toString('hex')}`;
}
