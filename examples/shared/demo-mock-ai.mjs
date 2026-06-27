/** Shared mock host key pool for walkthrough demos (no real provider key). */
export function createDemoHostKeyPool() {
  const replyFor = (messages) => {
    const last = messages.at(-1)?.content ?? '';
    return `Demo wallet reply: you said "${last}"`;
  };

  return {
    has(id) {
      return id === 'openai' || id === 'anthropic' || id === 'gemini';
    },
    async resolveClient(providerId) {
      const id =
        providerId === 'openai' || providerId === 'anthropic' || providerId === 'gemini'
          ? providerId
          : 'openai';
      return {
        providerId: id,
        client: {
          async complete(messages) {
            const content = replyFor(messages);
            return {
              content,
              model: 'demo-wallet',
              usage: { inputTokens: 12, outputTokens: content.length },
            };
          },
          async *stream(messages) {
            const text = replyFor(messages);
            for (const ch of text) yield ch;
          },
        },
      };
    },
  };
}
