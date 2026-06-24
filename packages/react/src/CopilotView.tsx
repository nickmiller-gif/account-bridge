import { useEffect, useRef } from 'react';

import type { ProviderId } from '@account-bridge/core';
import {
  headlessCopilotPreset,
  mergeCopilotClassNames,
  friendlyCopilotError,
  COPILOT_COMPOSER_HINT,
  type CopilotClassNames,
  type CopilotController,
  type CopilotViewState,
  DEFAULT_SUGGESTED_PROMPTS,
} from '@account-bridge/ui';

import { ProviderIcon } from './ProviderIcon.js';

function labelForProvider(providerId: ProviderId, state: CopilotViewState): string {
  const fromConnected = state.connectedProviders.find((p) => p.id === providerId)?.label;
  return fromConnected ?? providerId;
}

export interface CopilotViewProps {
  state: CopilotViewState;
  controller: CopilotController;
  classNames?: Partial<CopilotClassNames>;
  className?: string;
  hideHeader?: boolean;
  placeholder?: string;
  sendLabel?: string;
  clearLabel?: string;
  regenerateLabel?: string;
  suggestedPrompts?: readonly string[];
}

export function CopilotView({
  state,
  controller,
  classNames: classNameOverrides,
  className,
  hideHeader = false,
  placeholder = 'Ask anything…',
  sendLabel = 'Send',
  clearLabel = 'Clear chat',
  regenerateLabel = 'Try again',
  suggestedPrompts = DEFAULT_SUGGESTED_PROMPTS,
}: CopilotViewProps) {
  const cn = mergeCopilotClassNames(headlessCopilotPreset, classNameOverrides);
  const listRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const wasBusyRef = useRef(false);

  const isMicrosoft =
    state.selectedProviderId === 'microsoft_copilot' ||
    state.providerId === 'microsoft_copilot' ||
    (state.providerLocked && state.connectedProviders[0]?.id === 'microsoft_copilot');

  const emptyHint = isMicrosoft
    ? 'Ask Microsoft Copilot using your work account — not the app host.'
    : 'Replies use your connected provider. You control the account and the spend.';

  useEffect(() => {
    const el = listRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [state.messages, state.busy]);

  useEffect(() => {
    if (wasBusyRef.current && !state.busy) {
      textareaRef.current?.focus();
    }
    wasBusyRef.current = state.busy;
  }, [state.busy]);

  const canRegenerate =
    !state.busy &&
    state.messages.length > 0 &&
    state.messages[state.messages.length - 1]?.role === 'assistant';

  const lastMessage = state.messages[state.messages.length - 1];
  const showTyping =
    state.busy && lastMessage?.role === 'assistant' && !lastMessage.content.trim();

  const badgeProviderId =
    state.providerId ?? state.selectedProviderId ?? state.connectedProviders[0]?.id;
  const badgeLabel =
    state.activeProviderLabel ??
    (badgeProviderId
      ? state.connectedProviders.find((p) => p.id === badgeProviderId)?.label ?? null
      : null);

  const friendlyError = state.error ? friendlyCopilotError(state.error) : null;

  return (
    <div className={[cn.root, className].filter(Boolean).join(' ')}>
      {hideHeader ? null : (
        <header className={cn.header}>
          <div className="ab-copilot__header-top">
            <div className="ab-copilot__header-copy">
              <h3 className={cn.title}>{state.title}</h3>
              <p className={cn.subtitle}>{state.subtitle}</p>
            </div>
            {badgeProviderId && badgeLabel ? (
              <div className="ab-copilot__provider-badge" title={badgeLabel}>
                <ProviderIcon providerId={badgeProviderId} className="ab-copilot__provider-icon" />
                <span className="ab-copilot__provider-name">{badgeLabel}</span>
              </div>
            ) : null}
          </div>

          {!state.providerLocked && state.connectedProviders.length > 1 ? (
            <label className="ab-copilot__provider-picker">
              <span className="ab-copilot__provider-picker-label">Reply via</span>
              <select
                className="ab-copilot__provider-select"
                value={state.selectedProviderId ?? ''}
                disabled={state.busy}
                onChange={(e) => controller.setProvider(e.target.value as ProviderId)}
              >
                {state.connectedProviders.map((provider) => (
                  <option key={provider.id} value={provider.id}>
                    {provider.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </header>
      )}

      <div ref={listRef} className={cn.messageList} role="log" aria-live="polite">
        {state.messages.length === 0 ? (
          <div className={cn.empty}>
            <span className="ab-copilot__empty-icon" aria-hidden>
              {isMicrosoft ? 'MS' : '✦'}
            </span>
            <p className="ab-copilot__empty-title">
              {isMicrosoft ? 'Ask Microsoft Copilot' : 'Start a conversation'}
            </p>
            <p className="ab-copilot__empty-hint">{emptyHint}</p>
            {suggestedPrompts.length > 0 ? (
              <div className="ab-copilot__prompts" role="group" aria-label="Suggested prompts">
                {suggestedPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    className="ab-copilot__prompt-chip"
                    disabled={state.busy}
                    onClick={() => void controller.sendPrompt(prompt)}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          state.messages.map((msg) => (
            <article
              key={msg.id}
              className={msg.role === 'user' ? cn.messageUser : cn.messageAssistant}
            >
              <span className={cn.messageRole}>
                {msg.role === 'user'
                  ? 'You'
                  : msg.providerId
                    ? labelForProvider(msg.providerId, state)
                    : 'Assistant'}
              </span>
              <div className={cn.messageContent}>
                {showTyping && msg.id === lastMessage?.id ? (
                  <span className="ab-copilot__typing" aria-label="Thinking">
                    <span />
                    <span />
                    <span />
                  </span>
                ) : (
                  msg.content || null
                )}
              </div>
            </article>
          ))
        )}
      </div>

      {friendlyError ? (
        <div className="ab-copilot__error-card" role="alert">
          <p>{friendlyError}</p>
          <div className="ab-copilot__error-actions">
            <button
              type="button"
              className={cn.button}
              disabled={state.busy}
              onClick={() => void controller.retryLast()}
            >
              Try again
            </button>
            <button
              type="button"
              className={cn.buttonSecondary}
              disabled={state.busy}
              onClick={() => controller.dismissError()}
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      <div className={cn.composer}>
        <textarea
          ref={textareaRef}
          className={cn.textarea}
          value={state.input}
          placeholder={placeholder}
          rows={2}
          disabled={state.busy}
          aria-describedby="ab-copilot-composer-hint"
          onChange={(e) => controller.setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void controller.send();
            }
          }}
        />
        <p id="ab-copilot-composer-hint" className="ab-copilot__composer-hint">
          {COPILOT_COMPOSER_HINT}
        </p>
        <div className={cn.toolbar}>
          <button
            type="button"
            className={cn.button}
            disabled={state.busy || !state.input.trim()}
            onClick={() => void controller.send()}
          >
            {state.busy ? 'Sending…' : sendLabel}
          </button>
          <button
            type="button"
            className={cn.buttonSecondary}
            disabled={state.busy || state.messages.length === 0}
            onClick={() => controller.clear()}
          >
            {clearLabel}
          </button>
          {canRegenerate ? (
            <button
              type="button"
              className={cn.buttonSecondary}
              disabled={state.busy}
              onClick={() => void controller.regenerateLast()}
            >
              {regenerateLabel}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
