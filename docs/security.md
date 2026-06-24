# Security

## Principles

1. **User-owned credentials** — API keys belong to the end user; the host app is a conduit, not the payer.
2. **Encrypt at rest** — All storage adapters persist AES-256-GCM encrypted blobs only.
3. **Validate before store** — `connect()` always calls the provider validation endpoint first.
4. **No key logging** — Sensitive fields are redacted in debug helpers (`safeJsonStringify`).
5. **Minimal validation scope** — Validation uses read-only endpoints (`GET /v1/models`).

## What never goes in git

- Real API keys or tokens
- Production encryption secrets
- User credential files under `~/.account-bridge/`

Use `.env.example` for variable **names** only.

## Browser vs server

| Pattern | Key location | Risk |
|---------|--------------|------|
| Browser demo (vite-demo) | IndexedDB, encrypted | Acceptable for personal tools; keys in browser memory during use |
| Server proxy (node-proxy) | Server DB / file | Recommended for multi-user production |
| Memory storage | Process RAM | Tests and ephemeral sessions only |

## Encryption

- Algorithm: AES-GCM, 256-bit key, 12-byte IV prepended to ciphertext
- Key derivation: PBKDF2-SHA256, 100k iterations (via `deriveKeyFromSecret`)
- Host supplies key material from session — library does not manage user auth

## CI

Provider validation is **mocked** in automated tests. No live API calls in CI.

## OAuth (v0.3)

- **PKCE** required for Google OAuth start (`code_challenge_method=S256`).
- **State** parameter stored server-side with TTL; reject missing/expired state on callback.
- **Client secrets** live in host environment only — never in `@account-bridge/*` packages or browser bundles.
- **Refresh tokens** stored inside encrypted credential blobs; refresh via host cron or `refreshGoogleToken`.
- **CSRF**: OAuth start requires authenticated host session (`resolveUser`).

## Credential schema v2

Stored payloads (encrypted):

```ts
| { kind: 'api_key'; apiKey: string; baseUrl?: string; defaultModel?: string }
| { kind: 'oauth'; accessToken: string; refreshToken?: string; expiresAt?: string }
```

Legacy v1 blobs `{ apiKey }` migrate automatically on read.

## Reporting

If you discover a credential handling issue, rotate affected keys immediately and report through your host app's security channel.
