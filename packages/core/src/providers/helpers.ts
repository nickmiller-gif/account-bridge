import type { ChatCompletionOptions, ChatMessage } from '../types.js';

export function buildOpenAiBody(messages: ChatMessage[], options: ChatCompletionOptions | undefined, stream: boolean) {
  return JSON.stringify({
    model: options?.model ?? 'gpt-4o-mini',
    messages,
    max_tokens: options?.maxTokens ?? 1024,
    temperature: options?.temperature ?? 0.7,
    stream,
  });
}

export function buildAnthropicBody(messages: ChatMessage[], options: ChatCompletionOptions | undefined, stream: boolean) {
  const system = messages.find((m) => m.role === 'system')?.content;
  const chatMessages = messages.filter((m) => m.role !== 'system');
  return JSON.stringify({
    model: options?.model ?? 'claude-3-5-haiku-latest',
    max_tokens: options?.maxTokens ?? 1024,
    temperature: options?.temperature ?? 0.7,
    stream,
    system,
    messages: chatMessages.map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    })),
  });
}

export function buildGeminiBody(messages: ChatMessage[], options: ChatCompletionOptions | undefined) {
  const system = messages.find((m) => m.role === 'system')?.content;
  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
  return JSON.stringify({
    systemInstruction: system ? { parts: [{ text: system }] } : undefined,
    contents,
    generationConfig: {
      maxOutputTokens: options?.maxTokens ?? 1024,
      temperature: options?.temperature ?? 0.7,
    },
  });
}

export async function readJsonOrThrow(res: Response, label: string): Promise<unknown> {
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`${label} request failed (${res.status}): ${errText.slice(0, 200)}`);
  }
  return res.json();
}
