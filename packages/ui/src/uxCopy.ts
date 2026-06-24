/** Map provider/API errors to operator-friendly copy. */
export function friendlyCopilotError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('insufficient') || lower.includes('402')) {
    return 'Your app credit balance is low. Add credits in Settings, then try again.';
  }
  if (lower.includes('no consumer provider') || lower.includes('not connected')) {
    return 'Connect a provider in Settings first, then try again.';
  }
  if (lower.includes('401') || lower.includes('invalid credential') || lower.includes('invalid api')) {
    return 'Your API key may be expired or invalid. Open Settings, reconnect, and try again.';
  }
  if (lower.includes('429') || lower.includes('rate limit')) {
    return 'Rate limit reached — wait a moment, then try again.';
  }
  if (lower.includes('network') || lower.includes('fetch') || lower.includes('failed to fetch')) {
    return 'Network issue — check your connection and try again.';
  }
  return message;
}

export const COPILOT_COMPOSER_HINT = 'Enter to send · Shift+Enter for new line';

export const SETTINGS_ONBOARDING_STEPS = [
  { num: '1', title: 'Pick a provider', detail: 'Choose OpenAI, Anthropic, Gemini, or Microsoft below.' },
  { num: '2', title: 'Connect securely', detail: 'Paste an API key or sign in with OAuth — stored encrypted locally.' },
  { num: '3', title: 'Start chatting', detail: 'Your assistant unlocks as soon as a provider is ready.' },
] as const;

export function isRecommendedProvider(providerId: string): boolean {
  return providerId === 'openai';
}
