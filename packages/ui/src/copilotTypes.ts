import type { ProviderId } from '@account-bridge/core';

export interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  /** Provider that generated this assistant turn */
  providerId?: ProviderId;
}

export interface CopilotConnectedProvider {
  id: ProviderId;
  label: string;
}

export interface CopilotViewState {
  messages: CopilotMessage[];
  input: string;
  busy: boolean;
  error: string | null;
  streaming: boolean;
  /** Provider used for the last successful reply */
  providerId: ProviderId | null;
  activeProviderLabel: string | null;
  /** User-selected provider when not locked */
  selectedProviderId: ProviderId | null;
  connectedProviders: CopilotConnectedProvider[];
  providerLocked: boolean;
  title: string;
  subtitle: string;
}

export interface CopilotClassNames {
  root: string;
  header: string;
  title: string;
  subtitle: string;
  messageList: string;
  messageUser: string;
  messageAssistant: string;
  messageRole: string;
  messageContent: string;
  composer: string;
  textarea: string;
  toolbar: string;
  button: string;
  buttonSecondary: string;
  error: string;
  empty: string;
  fab: string;
  panel: string;
  panelOpen: string;
  panelHeader: string;
}

export const DEFAULT_SUGGESTED_PROMPTS = [
  'Summarize this for me',
  'Help me draft a reply',
  'Explain step by step',
] as const;

export const MICROSOFT_COPILOT_SUGGESTED_PROMPTS = [
  'Summarize my recent emails',
  'Draft a reply to my team',
  'What should I focus on today?',
] as const;

export function copilotDefaultsForProvider(providerId?: ProviderId): {
  title: string;
  subtitle: string;
  suggestedPrompts: readonly string[];
  stream: boolean;
} {
  if (providerId === 'microsoft_copilot') {
    return {
      title: 'Microsoft Copilot',
      subtitle: 'Signed in with your work account — usage bills to your M365 Copilot license.',
      suggestedPrompts: MICROSOFT_COPILOT_SUGGESTED_PROMPTS,
      stream: false,
    };
  }
  return {
    title: 'Assistant',
    subtitle: 'Powered by your connected account — you control usage and billing.',
    suggestedPrompts: DEFAULT_SUGGESTED_PROMPTS,
    stream: true,
  };
}
