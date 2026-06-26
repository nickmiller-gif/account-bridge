import { describe, expect, it } from 'vitest';

import {
  normalizeAppSlug,
  parseFundingPolicyInput,
  validateAppSlug,
  validatePlatformEmail,
} from './validation.js';

describe('platform validation', () => {
  it('normalizes and validates slugs', () => {
    expect(validateAppSlug('My-Product')).toBe('my-product');
    expect(() => validateAppSlug('a')).toThrow(/2–48/);
    expect(() => validateAppSlug('platform')).toThrow(/reserved/i);
  });

  it('validates email addresses', () => {
    expect(validatePlatformEmail('Dev@Example.com')).toBe('dev@example.com');
    expect(() => validatePlatformEmail('not-an-email')).toThrow(/Invalid email/);
  });

  it('parses funding policy input strictly', () => {
    expect(parseFundingPolicyInput({ mode: 'byok' })).toEqual({ mode: 'byok' });
    expect(parseFundingPolicyInput({ mode: 'auto', wallet: { enabled: true } })).toEqual({
      mode: 'auto',
      wallet: { enabled: true },
    });
    expect(() => parseFundingPolicyInput({ mode: 'nope' })).toThrow(/Invalid funding mode/);
    expect(() => parseFundingPolicyInput('bad')).toThrow(/Invalid funding policy/);
  });

  it('normalizeAppSlug strips unsafe characters', () => {
    expect(normalizeAppSlug('  Hello!! World  ')).toBe('hello-world');
  });
});
