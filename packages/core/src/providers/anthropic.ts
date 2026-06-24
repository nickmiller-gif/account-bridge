import { z } from 'zod';

import {
  apiKeyCredentialSchema,
  normalizeStoredCredential,
  oauthCredentialSchema,
  resolveApiKey,
  resolveDefaultModel,
} from '../credentials.js';
import { parseSseTextStream } from '../streaming.js';
import type { AiProviderDefinition, ChatClient, ChatCompletionOptions, ChatMessage } from '../types.js';
import { buildAnthropicBody, readJsonOrThrow } from './helpers.js';

export const anthropicCredentialSchema = apiKeyCredentialSchema;

export type AnthropicCredentials = z.infer<typeof anthropicCredentialSchema>;

const DEFAULT_ANTHROPIC_BASE = 'https://api.anthropic.com';

export function anthropicProvider(): AiProviderDefinition<AnthropicCredentials> {
  return {
    id: 'anthropic',
    displayName: 'Anthropic',
    credentialSchema: anthropicCredentialSchema,
    capabilities: { streaming: true },
    helpUrl: 'https://console.anthropic.com/settings/keys',

    async validate(credentials, fetchImpl = fetch) {
      const cred = normalizeStoredCredential({ kind: 'api_key', ...credentials });
      const { apiKey, baseUrl } = resolveApiKey(cred);
      const base = baseUrl ?? DEFAULT_ANTHROPIC_BASE;
      try {
        const res = await fetchImpl(`${base}/v1/models`, {
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
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
      const base = baseUrl ?? DEFAULT_ANTHROPIC_BASE;
      const modelDefault = resolveDefaultModel(cred, 'claude-3-5-haiku-latest');
      const headers = {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      };

      return {
        async complete(messages: ChatMessage[], options?: ChatCompletionOptions) {
          const res = await fetchImpl(`${base}/v1/messages`, {
            method: 'POST',
            headers,
            body: buildAnthropicBody(messages, { ...options, model: options?.model ?? modelDefault }, false),
          });
          const data = (await readJsonOrThrow(res, 'Anthropic')) as {
            model: string;
            content: Array<{ type: string; text?: string }>;
            usage?: { input_tokens?: number; output_tokens?: number };
          };
          const text = data.content.find((c) => c.type === 'text')?.text ?? '';
          return {
            content: text,
            model: data.model,
            usage: {
              inputTokens: data.usage?.input_tokens,
              outputTokens: data.usage?.output_tokens,
            },
          };
        },

        async *stream(messages: ChatMessage[], options?: ChatCompletionOptions) {
          const res = await fetchImpl(`${base}/v1/messages`, {
            method: 'POST',
            headers,
            body: buildAnthropicBody(messages, { ...options, model: options?.model ?? modelDefault }, true),
          });
          if (!res.ok) {
            const errText = await res.text().catch(() => '');
            throw new Error(`Anthropic stream failed (${res.status}): ${errText.slice(0, 200)}`);
          }
          yield* parseSseTextStream(res.body);
        },
      };
    },
  };
}
