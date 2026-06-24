import type { AccountBridge, ChatMessage, ProviderId } from '@account-bridge/core';
import { ensureBridgeFundingReady } from './fundingReady.js';
import { friendlyCopilotError } from './uxCopy.js';

import type {
  CopilotConnectedProvider,
  CopilotMessage,
  CopilotViewState,
} from './copilotTypes.js';

export interface CopilotControllerOptions {
  bridge: AccountBridge;
  providerId?: ProviderId;
  systemPrompt?: string;
  /** Prefer streaming responses when the provider supports it (default true) */
  stream?: boolean;
  maxTurns?: number;
  title?: string;
  subtitle?: string;
}

function newId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export class CopilotController {
  private readonly bridge: AccountBridge;
  private readonly lockedProviderId?: ProviderId;
  private readonly systemPrompt?: string;
  private readonly streamPreferred: boolean;
  private readonly maxTurns: number;
  private readonly title: string;
  private readonly subtitle: string;

  private messages: CopilotMessage[] = [];
  private input = '';
  private busy = false;
  private error: string | null = null;
  private activeProviderId: ProviderId | null = null;
  private selectedProviderId: ProviderId | null = null;
  private connectedProviders: CopilotConnectedProvider[] = [];
  private lastClient: import('@account-bridge/core').ChatClient | null = null;

  private readonly listeners = new Set<(state: CopilotViewState) => void>();
  private readonly unsubBridge: () => void;

  constructor(options: CopilotControllerOptions) {
    this.bridge = options.bridge;
    this.lockedProviderId = options.providerId;
    this.selectedProviderId = options.providerId ?? null;
    this.systemPrompt = options.systemPrompt;
    this.streamPreferred = options.stream !== false;
    this.maxTurns = options.maxTurns ?? 20;
    this.title = options.title ?? 'Copilot';
    this.subtitle =
      options.subtitle ?? 'Uses your connected account—you stay in control of usage and billing.';

    this.unsubBridge = this.bridge.subscribe(() => {
      void this.refreshConnectedProviders();
    });
    void this.refreshConnectedProviders();
  }

  getState(): CopilotViewState {
    const activeLabel = this.labelFor(this.activeProviderId);
    const selectedLabel = this.labelFor(this.selectedProviderId);
    const fallbackLabel =
      this.connectedProviders.length === 1 ? this.connectedProviders[0]!.label : null;

    return {
      messages: this.messages,
      input: this.input,
      busy: this.busy,
      error: this.error,
      streaming: this.streamPreferred,
      providerId: this.activeProviderId,
      activeProviderLabel: activeLabel ?? selectedLabel ?? fallbackLabel,
      selectedProviderId: this.selectedProviderId,
      connectedProviders: this.connectedProviders,
      providerLocked: Boolean(this.lockedProviderId),
      title: this.title,
      subtitle: this.subtitle,
    };
  }

  subscribe(listener: (state: CopilotViewState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  destroy(): void {
    this.unsubBridge();
    this.listeners.clear();
  }

  private emit(): void {
    for (const listener of this.listeners) listener(this.getState());
  }

  private labelFor(providerId: ProviderId | null): string | null {
    if (!providerId) return null;
    return this.bridge.getProviderDefinition(providerId)?.displayName ?? providerId;
  }

  private resolveProviderId(): ProviderId | undefined {
    return this.lockedProviderId ?? this.selectedProviderId ?? undefined;
  }

  async refreshConnectedProviders(): Promise<void> {
    const list = await this.bridge.listProviders();
    this.connectedProviders = list
      .filter((p) => p.connected)
      .map((p) => ({
        id: p.providerId,
        label: this.bridge.getProviderDefinition(p.providerId)?.displayName ?? p.providerId,
      }));

    if (this.lockedProviderId) {
      this.selectedProviderId = this.lockedProviderId;
    } else if (
      this.selectedProviderId &&
      !this.connectedProviders.some((p) => p.id === this.selectedProviderId)
    ) {
      this.selectedProviderId = this.connectedProviders[0]?.id ?? null;
    } else if (!this.selectedProviderId && this.connectedProviders.length === 1) {
      this.selectedProviderId = this.connectedProviders[0]!.id;
    }

    this.emit();
  }

  setProvider(providerId: ProviderId): void {
    if (this.lockedProviderId) return;
    if (!this.connectedProviders.some((p) => p.id === providerId)) return;
    this.selectedProviderId = providerId;
    this.emit();
  }

  setInput(value: string): void {
    this.input = value;
    this.emit();
  }

  async sendPrompt(text: string): Promise<void> {
    this.input = text.trim();
    this.emit();
    await this.send();
  }

  clear(): void {
    this.lastClient?.resetConversation?.();
    this.lastClient = null;
    this.messages = [];
    this.error = null;
    this.activeProviderId = null;
    this.emit();
  }

  dismissError(): void {
    this.error = null;
    this.emit();
  }

  async retryLast(): Promise<void> {
    if (this.busy) return;
    this.error = null;
    const lastUser = [...this.messages].reverse().find((m) => m.role === 'user');
    if (!lastUser) {
      this.emit();
      return;
    }
    this.input = lastUser.content;
    this.messages = this.messages.filter((m) => m.id !== lastUser.id);
    this.emit();
    await this.send();
  }

  private buildChatMessages(): ChatMessage[] {
    const out: ChatMessage[] = [];
    if (this.systemPrompt?.trim()) {
      out.push({ role: 'system', content: this.systemPrompt.trim() });
    }
    const recent = this.messages.slice(-this.maxTurns * 2);
    for (const msg of recent) {
      if (msg.role === 'assistant' && !msg.content.trim()) continue;
      out.push({ role: msg.role, content: msg.content });
    }
    return out;
  }

  async send(): Promise<void> {
    const text = this.input.trim();
    if (!text || this.busy) return;

    const userMessage: CopilotMessage = {
      id: newId(),
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };

    this.messages = [...this.messages, userMessage];
    this.input = '';
    this.busy = true;
    this.error = null;
    this.emit();

    const assistantId = newId();
    const assistantPlaceholder: CopilotMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
    };
    this.messages = [...this.messages, assistantPlaceholder];
    this.emit();

    try {
      const resolvedId = await ensureBridgeFundingReady(this.bridge, this.resolveProviderId());
      const { client, providerId } = await this.bridge.resolveClient(resolvedId);
      this.activeProviderId = providerId;
      this.selectedProviderId = providerId;
      this.lastClient = client;

      const chatMessages = this.buildChatMessages();
      const definition = this.bridge.getProviderDefinition(providerId);
      const streamingCap = definition?.capabilities?.streaming !== false;
      const useStream =
        this.streamPreferred && streamingCap && providerId !== 'microsoft_copilot' && Boolean(client.stream);

      const finalizeAssistant = (content: string) => {
        this.messages = this.messages.map((m) =>
          m.id === assistantId ? { ...m, content, providerId } : m,
        );
      };

      if (useStream && client.stream) {
        let content = '';
        for await (const chunk of client.stream(chatMessages)) {
          content += chunk;
          this.messages = this.messages.map((m) =>
            m.id === assistantId ? { ...m, content, providerId } : m,
          );
          this.emit();
        }
        if (!content) {
          finalizeAssistant('(No response)');
        }
      } else {
        const result = await client.complete(chatMessages);
        finalizeAssistant(result.content);
      }
    } catch (err) {
      this.messages = this.messages.filter((m) => m.id !== assistantId);
      const raw = err instanceof Error ? err.message : 'Copilot request failed';
      this.error = friendlyCopilotError(raw);
    } finally {
      this.busy = false;
      this.emit();
    }
  }

  async regenerateLast(): Promise<void> {
    if (this.busy || this.messages.length === 0) return;
    const last = this.messages[this.messages.length - 1];
    if (last?.role === 'assistant') {
      this.messages = this.messages.slice(0, -1);
    }
    const lastUser = [...this.messages].reverse().find((m) => m.role === 'user');
    if (!lastUser) return;
    this.input = lastUser.content;
    this.messages = this.messages.filter((m) => m.id !== lastUser.id);
    this.emit();
    await this.send();
  }
}

export function createCopilotController(options: CopilotControllerOptions): CopilotController {
  return new CopilotController(options);
}
