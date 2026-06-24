import { z } from 'zod';

import { apiKeyCredentialSchema, normalizeStoredCredential, resolveApiKey, resolveDefaultModel } from '../credentials.js';
import { parseSseTextStream } from '../streaming.js';
import type { AiProviderDefinition, ChatClient, ChatCompletionOptions, ChatMessage } from '../types.js';
import { buildOpenAiBody, readJsonOrThrow } from './helpers.js';

export const openAiCredentialSchema = apiKeyCredentialSchema;

export type OpenAiCredentials = z.infer<typeof openAiCredentialSchema>;

const DEFAULT_OPENAI_BASE = 'https://api.openai.com';

export function openaiProvider(): AiProviderDefinition<OpenAiCredentials> {
  return {
    id: 'openai',
    displayName: 'OpenAI',
    credentialSchema: openAiCredentialSchema,
    capabilities: { streaming: true },
    helpUrl: 'https://platform.openai.com/api-keys',

    async validate(credentials, fetchImpl = fetch) {
      const cred = normalizeStoredCredential({ kind: 'api_key', ...credentials });
      const { apiKey, baseUrl } = resolveApiKey(cred);
      const base = baseUrl ?? DEFAULT_OPENAI_BASE;
      try {
        const res = await fetchImpl(`${base}/v1/models`, {
          headers: { Authorization: `Bearer ${apiKey}` },
        });
        if (res.ok) {
          return { ok: true, metadata: { status: res.status } };
        }
        const body = await res.text().catch(() => '');
        return {
          ok: false,
          message: res.status === 401 ? 'Invalid API key' : `Validation failed (${res.status})`,
          metadata: { status: res.status, body: body.slice(0, 200) },
        };
      } catch (err) {
        return { ok: false, message: (err as Error).message };
      }
    },

    createChatClient(credentials, fetchImpl = fetch): ChatClient {
      const cred = normalizeStoredCredential({ kind: 'api_key', ...credentials });
      const { apiKey, baseUrl } = resolveApiKey(cred);
      const base = baseUrl ?? DEFAULT_OPENAI_BASE;
      const modelDefault = resolveDefaultModel(cred, 'gpt-4o-mini');
      const headers = {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      };

      return {
        async complete(messages: ChatMessage[], options?: ChatCompletionOptions) {
          const res = await fetchImpl(`${base}/v1/chat/completions`, {
            method: 'POST',
            headers,
            body: buildOpenAiBody(messages, { ...options, model: options?.model ?? modelDefault }, false),
          });
          const data = (await readJsonOrThrow(res, 'OpenAI')) as {
            model: string;
            choices: Array<{ message: { content: string } }>;
            usage?: { prompt_tokens?: number; completion_tokens?: number };
          };
          return {
            content: data.choices[0]?.message?.content ?? '',
            model: data.model,
            usage: {
              inputTokens: data.usage?.prompt_tokens,
              outputTokens: data.usage?.completion_tokens,
            },
          };
        },

        async *stream(messages: ChatMessage[], options?: ChatCompletionOptions) {
          const res = await fetchImpl(`${base}/v1/chat/completions`, {
            method: 'POST',
            headers,
            body: buildOpenAiBody(messages, { ...options, model: options?.model ?? modelDefault }, true),
          });
          if (!res.ok) {
            const errText = await res.text().catch(() => '');
            throw new Error(`OpenAI stream failed (${res.status}): ${errText.slice(0, 200)}`);
          }
          yield* parseSseTextStream(res.body);
        },
      };
    },
  };
}
