import { z } from 'zod';

import { apiKeyCredentialSchema, normalizeStoredCredential, resolveApiKey } from '../credentials.js';
import { parseSseTextStream } from '../streaming.js';
import type { AiProviderDefinition, ChatClient, ChatCompletionOptions, ChatMessage } from '../types.js';
import { buildOpenAiBody, readJsonOrThrow } from './helpers.js';

export interface OpenAICompatibleConfig {
  id: string;
  displayName: string;
  baseUrl: string;
  defaultModel?: string;
  /** When true, validation skips remote check if apiKey is empty (local Ollama). */
  apiKeyOptional?: boolean;
  apiKeyHeader?: string;
}

export function createOpenAICompatibleProvider(
  config: OpenAICompatibleConfig,
): AiProviderDefinition {
  const credentialSchema = apiKeyCredentialSchema.extend({
    baseUrl: z.string().url().optional(),
  });

  const defaultModel = config.defaultModel ?? 'gpt-4o-mini';

  return {
    id: config.id,
    displayName: config.displayName,
    credentialSchema,
    capabilities: { streaming: true },

    async validate(credentials, fetchImpl = fetch) {
      const cred = normalizeStoredCredential({ kind: 'api_key', ...credentials });
      const { apiKey, baseUrl } = resolveApiKey(cred);
      const base = baseUrl ?? config.baseUrl;

      if (config.apiKeyOptional && !apiKey) {
        return { ok: true, metadata: { local: true } };
      }

      try {
        const headers: Record<string, string> = {};
        if (apiKey) {
          headers[config.apiKeyHeader ?? 'Authorization'] =
            config.apiKeyHeader ? apiKey : `Bearer ${apiKey}`;
        }
        const res = await fetchImpl(`${base}/v1/models`, { headers });
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
      const base = baseUrl ?? config.baseUrl;
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (apiKey) {
        if (config.apiKeyHeader) {
          headers[config.apiKeyHeader] = apiKey;
        } else {
          headers.Authorization = `Bearer ${apiKey}`;
        }
      }

      const modelDefault = cred.defaultModel ?? defaultModel;

      return {
        async complete(messages: ChatMessage[], options?: ChatCompletionOptions) {
          const res = await fetchImpl(`${base}/v1/chat/completions`, {
            method: 'POST',
            headers,
            body: buildOpenAiBody(messages, { ...options, model: options?.model ?? modelDefault }, false),
          });
          const data = (await readJsonOrThrow(res, config.displayName)) as {
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
            throw new Error(`${config.displayName} stream failed (${res.status}): ${errText.slice(0, 200)}`);
          }
          yield* parseSseTextStream(res.body);
        },
      };
    },
  };
}
