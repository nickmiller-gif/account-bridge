import { describe, expect, it } from 'vitest';

import {
  assertHostSessionToken,
  assertNoInlineProviderKey,
  looksLikeProviderApiKey,
} from '../src/consumerCredits.js';
import { ConsumerCreditsRequiredError } from '../src/errors.js';

describe('consumerCredits', () => {
  it('detects provider API key patterns', () => {
    expect(looksLikeProviderApiKey('sk-proj-abc123456789012345678')).toBe(true);
    expect(looksLikeProviderApiKey('sk-ant-api03-test')).toBe(true);
    expect(looksLikeProviderApiKey('eyJhbGciOiJIUzI1NiJ9.session')).toBe(false);
  });

  it('rejects provider keys as host session tokens', () => {
    expect(() => assertHostSessionToken('sk-test-key-1234567890')).toThrow(ConsumerCreditsRequiredError);
  });

  it('blocks inline api_key in request bodies', () => {
    expect(() => assertNoInlineProviderKey({ api_key: 'sk-test' })).toThrow(ConsumerCreditsRequiredError);
    expect(() => assertNoInlineProviderKey({ messages: [] })).not.toThrow();
  });
});
