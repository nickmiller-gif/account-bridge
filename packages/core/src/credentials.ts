import { z } from 'zod';

export const apiKeyCredentialSchema = z.object({
  kind: z.literal('api_key').optional(),
  apiKey: z.string().min(1),
  baseUrl: z.string().url().optional(),
  defaultModel: z.string().optional(),
});

export const oauthCredentialSchema = z.object({
  kind: z.literal('oauth'),
  accessToken: z.string().min(1),
  refreshToken: z.string().optional(),
  expiresAt: z.string().optional(),
  scope: z.string().optional(),
  defaultModel: z.string().optional(),
});

export const storedCredentialSchema = z.union([apiKeyCredentialSchema, oauthCredentialSchema]);

export type ApiKeyCredential = z.infer<typeof apiKeyCredentialSchema>;
export type OAuthCredential = z.infer<typeof oauthCredentialSchema>;
export type StoredCredential = z.infer<typeof storedCredentialSchema>;

export type AuthKind = 'api_key' | 'oauth';

/** Legacy v1 blobs stored bare `{ apiKey }` without kind. */
export function normalizeStoredCredential(raw: unknown): StoredCredential {
  const parsed = raw as Record<string, unknown>;
  if (parsed.kind === 'oauth') {
    return oauthCredentialSchema.parse(raw);
  }
  if (parsed.kind === 'api_key' || typeof parsed.apiKey === 'string') {
    return apiKeyCredentialSchema.parse({ kind: 'api_key', ...parsed });
  }
  throw new Error('Unrecognized credential payload');
}

export function authKindOf(credential: StoredCredential): AuthKind {
  return credential.kind === 'oauth' ? 'oauth' : 'api_key';
}

export function resolveApiKey(credential: StoredCredential): { apiKey: string; baseUrl?: string } {
  if (credential.kind === 'oauth') {
    return { apiKey: credential.accessToken };
  }
  return { apiKey: credential.apiKey, baseUrl: credential.baseUrl };
}

export function resolveDefaultModel(credential: StoredCredential, fallback: string): string {
  return credential.defaultModel ?? fallback;
}
