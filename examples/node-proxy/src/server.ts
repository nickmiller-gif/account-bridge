import express from 'express';

import { mountAccountBridgeHost, memoryOAuthStateStore } from '@account-bridge/server';

const PORT = Number(process.env.PORT ?? 3920);
const HOST = process.env.HOST ?? '127.0.0.1';
const APP_ID = process.env.ACCOUNT_BRIDGE_APP_ID ?? 'node-proxy';
const ENCRYPTION_SECRET = process.env.PROXY_ENCRYPTION_SECRET ?? 'dev-only-secret';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
const OAUTH_REDIRECT_URI =
  process.env.GOOGLE_OAUTH_REDIRECT_URI ?? `http://localhost:${PORT}/account-bridge/oauth/google/callback`;
const MICROSOFT_CLIENT_ID = process.env.MICROSOFT_OAUTH_CLIENT_ID;
const MICROSOFT_CLIENT_SECRET = process.env.MICROSOFT_OAUTH_CLIENT_SECRET;
const MICROSOFT_REDIRECT_URI =
  process.env.MICROSOFT_OAUTH_REDIRECT_URI ??
  `http://localhost:${PORT}/account-bridge/oauth/microsoft/callback`;
const MICROSOFT_TENANT_ID = process.env.MICROSOFT_OAUTH_TENANT_ID ?? 'common';

/** Demo auth — replace with real JWT/session validation */
function userIdFromAuth(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) return null;
  return `user:${token}`;
}

function resolveUserFromReq(req: { headers: { authorization?: string } }): string | null {
  return userIdFromAuth(req.headers.authorization);
}

const app = express();

const DEFAULT_ORIGINS = ['http://localhost:5175', 'http://127.0.0.1:5175'];
const VITE_ORIGINS = (process.env.DEMO_CORS_ORIGINS ?? '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
const CORS_ORIGINS = VITE_ORIGINS.length > 0 ? VITE_ORIGINS : DEFAULT_ORIGINS;

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && CORS_ORIGINS.includes(origin)) {
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
});

app.use(express.json());

const oauthStateStore = memoryOAuthStateStore();
const baseUrl = process.env.PUBLIC_BASE_URL ?? `http://localhost:${PORT}`;

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    appId: APP_ID,
    gateway: true,
    consumerCreditsEnforced: true,
    oauth: Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET),
    microsoftOAuth: Boolean(MICROSOFT_CLIENT_ID && MICROSOFT_CLIENT_SECRET),
  });
});

mountAccountBridgeHost({
  app,
  config: {
    appId: APP_ID,
    baseUrl,
    getAuthHeaders: () => ({}),
    encryptionSecret: ENCRYPTION_SECRET,
    includeMicrosoftCopilot: Boolean(MICROSOFT_CLIENT_ID && MICROSOFT_CLIENT_SECRET),
  },
  resolveUser: resolveUserFromReq,
  stateStore: oauthStateStore,
  google:
    GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET
      ? {
          clientId: GOOGLE_CLIENT_ID,
          clientSecret: GOOGLE_CLIENT_SECRET,
          redirectUri: OAUTH_REDIRECT_URI,
        }
      : undefined,
  microsoft:
    MICROSOFT_CLIENT_ID && MICROSOFT_CLIENT_SECRET
      ? {
          clientId: MICROSOFT_CLIENT_ID,
          clientSecret: MICROSOFT_CLIENT_SECRET,
          redirectUri: MICROSOFT_REDIRECT_URI,
          tenantId: MICROSOFT_TENANT_ID,
        }
      : undefined,
  oauthSuccessRedirect: '/?oauth=success',
});

app.listen(PORT, HOST, () => {
  const displayHost = HOST === '0.0.0.0' ? '127.0.0.1' : HOST;
  console.log(`Account Bridge host v0.7 on http://${displayHost}:${PORT} (appId=${APP_ID})`);
  console.log(`Consumer settings: http://localhost:${PORT}/account-bridge/providers`);
  console.log(`OpenAI gateway (consumer credits): http://localhost:${PORT}/v1/chat/completions`);
});
