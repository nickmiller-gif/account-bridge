/** Shared CORS middleware for local walkthrough hosts (vite-demo :5175, platform dashboard :5176). */
const DEFAULT_ORIGINS = [
  'http://localhost:5175',
  'http://127.0.0.1:5175',
  'http://localhost:5176',
  'http://127.0.0.1:5176',
];

function isAllowedHttpOrigin(origin) {
  try {
    const url = new URL(origin);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function parseDemoCorsOrigins(envValue = process.env.DEMO_CORS_ORIGINS) {
  if (!envValue?.trim()) return DEFAULT_ORIGINS;
  return envValue
    .split(',')
    .map((o) => o.trim())
    .filter((o) => isAllowedHttpOrigin(o));
}

export function createDemoCorsMiddleware(origins = parseDemoCorsOrigins()) {
  const allowlist = new Set(origins);
  return (req, res, next) => {
    const origin = req.headers.origin;
    const allowed = Boolean(origin && allowlist.has(origin));
    if (allowed && origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Authorization, Content-Type, X-Idempotency-Key, X-Account-Bridge-Provider, X-Account-Bridge-Publishable-Key, X-Demo-User',
      );
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    }
    if (req.method === 'OPTIONS') {
      if (!allowed) {
        res.sendStatus(403);
        return;
      }
      res.sendStatus(204);
      return;
    }
    next();
  };
}
