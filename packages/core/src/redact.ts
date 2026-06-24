const SENSITIVE_KEYS = new Set(['apiKey', 'api_key', 'token', 'secret', 'password', 'authorization']);

export function redactSensitive(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(redactSensitive);
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEYS.has(k.toLowerCase()) ? '[REDACTED]' : redactSensitive(v);
    }
    return out;
  }
  return value;
}

export function safeJsonStringify(value: unknown): string {
  return JSON.stringify(redactSensitive(value));
}
