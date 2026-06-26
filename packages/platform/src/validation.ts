import type { FundingPolicy } from '@account-bridge/core';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const RESERVED_APP_SLUGS = new Set([
  'platform',
  'admin',
  'api',
  'health',
  'billing',
  'demo',
  'www',
  'v1',
  'account-bridge',
]);

export function normalizeAppSlug(slug: string): string {
  return slug
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function validatePlatformEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (!normalized || !EMAIL_RE.test(normalized) || normalized.length > 254) {
    throw new Error('Invalid email address.');
  }
  return normalized;
}

export function validateHostDisplayName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length > 120) {
    throw new Error('Name must be 120 characters or fewer.');
  }
  return trimmed;
}

export function validateAppSlug(raw: string): string {
  const slug = normalizeAppSlug(raw);
  if (!slug) throw new Error('App slug is required.');
  if (slug.length < 2 || slug.length > 48) {
    throw new Error('Slug must be 2–48 characters (lowercase letters, numbers, hyphens).');
  }
  if (RESERVED_APP_SLUGS.has(slug)) {
    throw new Error('Slug is reserved.');
  }
  return slug;
}

export function validateAppDisplayName(name: string, fallbackSlug: string): string {
  const trimmed = name.trim();
  if (!trimmed) return fallbackSlug;
  if (trimmed.length > 120) {
    throw new Error('Display name must be 120 characters or fewer.');
  }
  return trimmed;
}

export function parseFundingPolicyInput(input: unknown): FundingPolicy | undefined {
  if (input === undefined || input === null) return undefined;
  if (typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Invalid funding policy.');
  }
  const record = input as { mode?: string; wallet?: { enabled?: boolean } };
  if (!record.mode || !['byok', 'wallet', 'auto'].includes(record.mode)) {
    throw new Error('Invalid funding mode.');
  }
  const mode = record.mode as FundingPolicy['mode'];
  const walletEnabled = record.wallet?.enabled === true;
  if (mode === 'wallet') {
    return { mode: 'wallet', wallet: { enabled: true } };
  }
  if (mode === 'auto') {
    return walletEnabled
      ? { mode: 'auto', wallet: { enabled: true } }
      : { mode: 'auto' };
  }
  return { mode: 'byok' };
}
