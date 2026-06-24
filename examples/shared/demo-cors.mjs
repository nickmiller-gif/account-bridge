/** Shared CORS middleware for local walkthrough hosts (vite-demo on :5175). */
const DEFAULT_ORIGINS = ['http://localhost:5175', 'http://127.0.0.1:5175'];

export function parseDemoCorsOrigins(envValue = process.env.DEMO_CORS_ORIGINS) {
  if (!envValue?.trim()) return DEFAULT_ORIGINS;
  return envValue
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

export function createDemoCorsMiddleware(origins = parseDemoCorsOrigins()) {
  const allowlist = new Set(origins);
  return (req, res, next) => {
    const origin = req.headers.origin;
    if (origin && allowlist.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Authorization, Content-Type, X-Idempotency-Key, X-Account-Bridge-Provider',
      );
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    }
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  };
}
