const SAFE_ERROR_PREFIXES = [
  'Invalid email',
  'Invalid funding',
  'Slug must',
  'Slug is required',
  'Slug is reserved',
  'App slug',
  'Plan limit',
  'Wallet funding requires',
  'Unable to create account',
  'Subscription inactive',
  'Host not found',
  'App not found',
  'Display name must',
  'Name must',
  'email required',
  'slug required',
  'planId must',
  'Unauthorized',
  'Missing or invalid app credentials',
  'Monthly request limit',
  'Too many requests',
  'Missing stripe-signature',
  'Webhook requires',
  'Stripe not configured',
];

export function platformClientError(err: unknown, fallback: string): string {
  if (!(err instanceof Error)) return fallback;
  const message = err.message.trim();
  if (!message) return fallback;
  if (SAFE_ERROR_PREFIXES.some((prefix) => message.startsWith(prefix) || message.includes(prefix))) {
    return message;
  }
  return fallback;
}
