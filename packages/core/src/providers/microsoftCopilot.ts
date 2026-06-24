import { z } from 'zod';

import { normalizeStoredCredential, oauthCredentialSchema } from '../credentials.js';
import type {
  AiProviderDefinition,
  ChatClient,
  ChatCompletionOptions,
  ChatMessage,
} from '../types.js';
import { readJsonOrThrow } from './helpers.js';

export const microsoftCopilotCredentialSchema = oauthCredentialSchema;

export type MicrosoftCopilotCredentials = z.infer<typeof microsoftCopilotCredentialSchema>;

const GRAPH_BETA = 'https://graph.microsoft.com/beta';

/** Scopes required by the M365 Copilot Chat API (delegated). */
export const MICROSOFT_COPILOT_OAUTH_SCOPES = [
  'openid',
  'profile',
  'offline_access',
  'Sites.Read.All',
  'Mail.Read',
  'People.Read.All',
  'OnlineMeetingTranscript.Read.All',
  'Chat.Read',
  'ChannelMessage.Read.All',
  'ExternalItem.Read.All',
] as const;

function resolveTimeZone(explicit?: string): string {
  if (explicit?.trim()) return explicit.trim();
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

interface CopilotConversationResponse {
  id?: string;
  messages?: Array<{ id?: string; text?: string; createdDateTime?: string }>;
}

function extractAssistantReply(conversation: CopilotConversationResponse): string {
  const messages = conversation.messages ?? [];
  if (messages.length === 0) return '';
  const last = messages[messages.length - 1];
  return last?.text ?? '';
}

function buildChatBody(messages: ChatMessage[], options?: ChatCompletionOptions) {
  const userMessages = messages.filter((m) => m.role === 'user');
  const lastUser = userMessages[userMessages.length - 1];
  if (!lastUser?.content.trim()) {
    throw new Error('Microsoft Copilot requires a user message');
  }

  const systemContext = messages
    .filter((m) => m.role === 'system')
    .map((m) => ({ text: m.content.trim() }))
    .filter((m) => m.text.length > 0);

  const metadata = (options as ChatCompletionOptions & { microsoftCopilot?: MicrosoftCopilotRequestExtras })
    ?.microsoftCopilot;

  const additionalContext = [
    ...systemContext,
    ...(metadata?.additionalContext ?? []).map((text) => ({ text })),
  ];

  return {
    message: { text: lastUser.content.trim() },
    locationHint: {
      timeZone: resolveTimeZone(metadata?.timeZone),
    },
    ...(additionalContext.length ? { additionalContext } : {}),
    ...(metadata?.contextualResources ? { contextualResources: metadata.contextualResources } : {}),
  };
}

export interface MicrosoftCopilotRequestExtras {
  timeZone?: string;
  additionalContext?: string[];
  contextualResources?: Record<string, unknown>;
}

export function microsoftCopilotProvider(): AiProviderDefinition<MicrosoftCopilotCredentials> {
  return {
    id: 'microsoft_copilot',
    displayName: 'Microsoft Copilot',
    credentialSchema: microsoftCopilotCredentialSchema,
    capabilities: { streaming: false },
    supportsOAuth: true,
    supportsApiKey: false,
    oauthProviderKey: 'microsoft',
    oauthButtonLabel: 'Connect with Microsoft',
    helpUrl:
      'https://learn.microsoft.com/en-us/microsoft-365/copilot/extensibility/copilot-apis-overview',

    async validate(credentials, fetchImpl = fetch) {
      const cred = normalizeStoredCredential(credentials);
      if (cred.kind !== 'oauth') {
        return { ok: false, message: 'Microsoft Copilot requires Microsoft sign-in (OAuth)' };
      }
      try {
        const res = await fetchImpl(`${GRAPH_BETA}/copilot/conversations`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${cred.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: '{}',
        });
        if (res.status === 201 || res.ok) {
          return { ok: true, metadata: { status: res.status } };
        }
        const body = await res.text().catch(() => '');
        const message =
          res.status === 401 || res.status === 403
            ? 'Microsoft sign-in invalid or missing Copilot license / Graph permissions'
            : `Validation failed (${res.status})`;
        return { ok: false, message, metadata: { status: res.status, body: body.slice(0, 200) } };
      } catch (err) {
        return { ok: false, message: (err as Error).message };
      }
    },

    createChatClient(credentials, fetchImpl = fetch): ChatClient {
      const cred = normalizeStoredCredential(credentials);
      if (cred.kind !== 'oauth') {
        throw new Error('Microsoft Copilot requires OAuth credentials');
      }
      const oauthCred = cred;

      let conversationId: string | null = null;

      async function authHeaders(): Promise<Record<string, string>> {
        return {
          Authorization: `Bearer ${oauthCred.accessToken}`,
          'Content-Type': 'application/json',
        };
      }

      async function ensureConversation(): Promise<string> {
        if (conversationId) return conversationId;
        const headers = await authHeaders();
        const res = await fetchImpl(`${GRAPH_BETA}/copilot/conversations`, {
          method: 'POST',
          headers,
          body: '{}',
        });
        const data = (await readJsonOrThrow(res, 'Microsoft Copilot')) as CopilotConversationResponse;
        if (!data.id) throw new Error('Microsoft Copilot did not return a conversation id');
        conversationId = data.id;
        return conversationId;
      }

      async function postChat(messages: ChatMessage[], options?: ChatCompletionOptions) {
        const convId = await ensureConversation();
        const headers = await authHeaders();
        const res = await fetchImpl(`${GRAPH_BETA}/copilot/conversations/${convId}/chat`, {
          method: 'POST',
          headers,
          body: JSON.stringify(buildChatBody(messages, options)),
        });
        const data = (await readJsonOrThrow(res, 'Microsoft Copilot chat')) as CopilotConversationResponse;
        return {
          content: extractAssistantReply(data),
          model: 'microsoft-copilot',
        };
      }

      return {
        async complete(messages, options) {
          return postChat(messages, options);
        },
        resetConversation() {
          conversationId = null;
        },
      };
    },
  };
}
