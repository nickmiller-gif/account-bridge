/** Parse SSE streams from OpenAI / Anthropic / similar providers. */
export async function* parseSseTextStream(
  body: ReadableStream<Uint8Array> | null,
): AsyncGenerator<string> {
  if (!body) return;
  const reader = body.getReader();
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
      const data = trimmed.slice(5).trim();
      if (data === '[DONE]') return;
      try {
        const parsed = JSON.parse(data) as Record<string, unknown>;
        const text = extractSseDelta(parsed);
        if (text) yield text;
      } catch {
        // ignore malformed chunks
      }
    }
  }
}

function extractSseDelta(parsed: Record<string, unknown>): string | null {
  const choices = parsed.choices as Array<{ delta?: { content?: string } }> | undefined;
  if (choices?.[0]?.delta?.content) return choices[0].delta.content;

  const type = (parsed.type as string | undefined) ?? '';
  if (type === 'content_block_delta') {
    const delta = parsed.delta as { text?: string } | undefined;
    if (delta?.text) return delta.text;
  }

  const candidates = parsed.candidates as
    | Array<{ content?: { parts?: Array<{ text?: string }> } }>
    | undefined;
  const geminiText = candidates?.[0]?.content?.parts?.[0]?.text;
  if (geminiText) return geminiText;

  return null;
}
