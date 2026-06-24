import { z } from 'zod';

import {
  apiKeyCredentialSchema,
  normalizeStoredCredential,
  oauthCredentialSchema,
  resolveApiKey,
  resolveDefaultModel,
  type StoredCredential,
} from '../credentials.js';
import type { AiProviderDefinition, ChatClient, ChatCompletionOptions, ChatMessage } from '../types.js';
import { buildGeminiBody, readJsonOrThrow } from './helpers.js';

export const geminiCredentialSchema = z.union([apiKeyCredentialSchema, oauthCredentialSchema]);

export type GeminiCredentials = z.infer<typeof geminiCredentialSchema>;

const DEFAULT_GEMINI_BASE = 'https://generativelanguage.googleapis.com';

function geminiAuthQuery(cred: StoredCredential): { query: string; headers: Record<string, string> } {
  if (cred.kind === 'oauth') {
    return {
      query: '',
      headers: { Authorization: `Bearer ${cred.accessToken}` },
    };
  }
  return {
    query: `?key=${encodeURIComponent(cred.apiKey)}`,
    headers: {},
  };
}

export function geminiProvider(): AiProviderDefinition<GeminiCredentials> {
  return {
    id: 'gemini',
    displayName: 'Google Gemini',
    credentialSchema: geminiCredentialSchema,
    capabilities: { streaming: true },
    supportsOAuth: true,
    oauthProviderKey: 'google',
    helpUrl: 'https://aistudio.google.com/apikey',

    async validate(credentials, fetchImpl = fetch) {
      const cred = normalizeStoredCredential(credentials);
      const base = (cred.kind === 'api_key' && cred.baseUrl) ? cred.baseUrl : DEFAULT_GEMINI_BASE;
      const { query, headers } = geminiAuthQuery(cred);
      try {
        const res = await fetchImpl(`${base}/v1beta/models${query}`, { headers });
        if (res.ok) {
          return { ok: true, metadata: { status: res.status } };
        }
        const body = await res.text().catch(() => '');
        return {
          ok: false,
          message: res.status === 400 || res.status === 403 ? 'Invalid credentials' : `Validation failed (${res.status})`,
          metadata: { status: res.status, body: body.slice(0, 200) },
        };
      } catch (err) {
        return { ok: false, message: (err as Error).message };
      }
    },

    createChatClient(credentials, fetchImpl = fetch): ChatClient {
      const cred = normalizeStoredCredential(credentials);
      const base = (cred.kind === 'api_key' && cred.baseUrl) ? cred.baseUrl : DEFAULT_GEMINI_BASE;
      const modelDefault = resolveDefaultModel(cred, 'gemini-2.0-flash');

      return {
        async complete(messages: ChatMessage[], options?: ChatCompletionOptions) {
          const chosenModel = options?.model ?? modelDefault;
          const { query, headers } = geminiAuthQuery(cred);
          const url = `${base}/v1beta/models/${chosenModel}:generateContent${query}`;
          const res = await fetchImpl(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...headers },
            body: buildGeminiBody(messages, options),
          });
          const data = (await readJsonOrThrow(res, 'Gemini')) as {
            candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
            usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
          };
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
          return {
            content: text,
            model: chosenModel,
            usage: {
              inputTokens: data.usageMetadata?.promptTokenCount,
              outputTokens: data.usageMetadata?.candidatesTokenCount,
            },
          };
        },

        async *stream(messages: ChatMessage[], options?: ChatCompletionOptions) {
          const chosenModel = options?.model ?? modelDefault;
          const { query, headers } = geminiAuthQuery(cred);
          const sep = query ? '&' : '?';
          const url = `${base}/v1beta/models/${chosenModel}:streamGenerateContent${query}${sep}alt=sse`;
          const res = await fetchImpl(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...headers },
            body: buildGeminiBody(messages, options),
          });
          if (!res.ok) {
            const errText = await res.text().catch(() => '');
            throw new Error(`Gemini stream failed (${res.status}): ${errText.slice(0, 200)}`);
          }
          const reader = res.body?.getReader();
          if (!reader) return;
          const decoder = new TextDecoder();
          let buffer = '';
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith('data:')) continue;
              try {
                const parsed = JSON.parse(trimmed.slice(5).trim()) as {
                  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
                };
                const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text) yield text;
              } catch {
                // skip malformed chunk
              }
            }
          }
        },
      };
    },
  };
}
