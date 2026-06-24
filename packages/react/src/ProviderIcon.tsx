import type { ProviderId } from '@account-bridge/core';

const PROVIDER_LABELS: Partial<Record<ProviderId, string>> = {
  openai: 'AI',
  anthropic: 'A',
  gemini: 'G',
  microsoft_copilot: 'MS',
  groq: 'Q',
  together: 'T',
  mistral: 'M',
  ollama: 'O',
};

export interface ProviderIconProps {
  providerId: ProviderId;
  className?: string;
}

export function ProviderIcon({ providerId, className }: ProviderIconProps) {
  const label = PROVIDER_LABELS[providerId] ?? providerId.slice(0, 2).toUpperCase();
  return (
    <span
      className={[className, `ab-settings__card-icon--${providerId}`].filter(Boolean).join(' ')}
      aria-hidden
    >
      {label}
    </span>
  );
}
