import type { AccountBridge, ProviderId } from './types.js';
import { ConsumerCreditsRequiredError } from './errors.js';

/** Patterns that indicate a provider API key, not a host session token. */
const PROVIDER_KEY_PATTERNS = [
  /^sk-[A-Za-z0-9-]{10,}/,
  /^sk-ant-[A-Za-z0-9-]{10,}/,
  /^AIza[A-Za-z0-9_-]{20,}/,
  /^ya29\.[A-Za-z0-9_-]+/,
];

export function looksLikeProviderApiKey(token: string): boolean {
  const trimmed = token.trim();
  if (!trimmed) return false;
  return PROVIDER_KEY_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/**
 * Reject gateway/auth tokens that look like provider API keys.
 * Host session JWTs must be used — consumer keys are stored via connect(), not Authorization.
 */
export function assertHostSessionToken(token: string | null | undefined): void {
  if (!token?.trim()) return;
  if (looksLikeProviderApiKey(token)) {
    throw new ConsumerCreditsRequiredError(
      'Provider API keys cannot be sent as Authorization. Connect consumer credentials via Account Bridge settings; use your app session token on the gateway.',
    );
  }
}

export function assertNoInlineProviderKey(body: unknown): void {
  if (!body || typeof body !== 'object') return;
  const record = body as Record<string, unknown>;
  if (typeof record.apiKey === 'string' && record.apiKey.trim()) {
    throw new ConsumerCreditsRequiredError(
      'Inline apiKey in AI requests is blocked. Consumer credentials must be connected via Account Bridge.',
    );
  }
  if (typeof record.api_key === 'string' && record.api_key.trim()) {
    throw new ConsumerCreditsRequiredError(
      'Inline api_key in AI requests is blocked. Consumer credentials must be connected via Account Bridge.',
    );
  }
}

export async function assertConsumerCreditsReady(
  bridge: AccountBridge,
  providerId?: ProviderId,
): Promise<ProviderId> {
  if (providerId) {
    if (!(await bridge.has(providerId))) {
      throw new ConsumerCreditsRequiredError(
        `Consumer must connect ${providerId} before using this feature.`,
        providerId,
      );
    }
    return providerId;
  }

  const defaultProvider = await bridge.getDefaultProvider();
  if (defaultProvider && (await bridge.has(defaultProvider))) {
    return defaultProvider;
  }

  const connected = (await bridge.listProviders()).filter((p) => p.connected);
  if (connected.length === 1) {
    return connected[0]!.providerId;
  }

  throw new ConsumerCreditsRequiredError(
    connected.length === 0
      ? 'Consumer must connect an AI provider before using this feature.'
      : 'Consumer must choose a default provider before using this feature.',
  );
}

export async function consumerCreditsReady(
  bridge: AccountBridge,
  providerId?: ProviderId,
): Promise<boolean> {
  try {
    await assertConsumerCreditsReady(bridge, providerId);
    return true;
  } catch {
    return false;
  }
}
