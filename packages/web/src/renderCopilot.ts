import type { ProviderId } from '@account-bridge/core';
import {
  DEFAULT_SUGGESTED_PROMPTS,
  COPILOT_COMPOSER_HINT,
  friendlyCopilotError,
  headlessCopilotPreset,
  type CopilotController,
  type CopilotViewState,
} from '@account-bridge/ui';

import { providerIconLabel } from './theme.js';

export interface CopilotRenderContext {
  root: HTMLElement;
  controller: CopilotController;
  listEl: HTMLElement;
  textarea: HTMLTextAreaElement;
  unsub?: () => void;
}

export interface CopilotRenderOptions {
  placeholder?: string;
  sendLabel?: string;
  clearLabel?: string;
  suggestedPrompts?: readonly string[];
}

export function mountCopilotView(
  host: HTMLElement,
  controller: CopilotController,
  options: CopilotRenderOptions = {},
): CopilotRenderContext {
  const cn = headlessCopilotPreset;
  const placeholder = options.placeholder ?? 'Ask anything…';
  const sendLabel = options.sendLabel ?? 'Send';
  const clearLabel = options.clearLabel ?? 'Clear chat';
  const suggestedPrompts = options.suggestedPrompts ?? DEFAULT_SUGGESTED_PROMPTS;

  const root = document.createElement('div');
  root.className = cn.root;

  const header = document.createElement('header');
  header.className = cn.header;

  const listEl = document.createElement('div');
  listEl.className = cn.messageList;
  listEl.setAttribute('role', 'log');
  listEl.setAttribute('aria-live', 'polite');

  const errorEl = document.createElement('div');
  errorEl.className = 'ab-copilot__error-card';
  errorEl.setAttribute('role', 'alert');
  errorEl.hidden = true;

  const textarea = document.createElement('textarea');
  textarea.className = cn.textarea;
  textarea.rows = 2;
  textarea.placeholder = placeholder;
  textarea.setAttribute('aria-describedby', 'ab-copilot-composer-hint');

  const hintEl = document.createElement('p');
  hintEl.id = 'ab-copilot-composer-hint';
  hintEl.className = 'ab-copilot__composer-hint';
  hintEl.textContent = COPILOT_COMPOSER_HINT;

  const sendBtn = document.createElement('button');
  sendBtn.type = 'button';
  sendBtn.className = cn.button;
  sendBtn.textContent = sendLabel;

  const clearBtn = document.createElement('button');
  clearBtn.type = 'button';
  clearBtn.className = cn.buttonSecondary;
  clearBtn.textContent = clearLabel;

  const composer = document.createElement('div');
  composer.className = cn.composer;
  const toolbar = document.createElement('div');
  toolbar.className = cn.toolbar;
  toolbar.append(sendBtn, clearBtn);
  composer.append(textarea, hintEl, toolbar);

  root.append(header, listEl, errorEl, composer);
  host.replaceChildren(root);

  let wasBusy = false;

  sendBtn.addEventListener('click', () => void controller.send());
  clearBtn.addEventListener('click', () => controller.clear());
  textarea.addEventListener('input', () => controller.setInput(textarea.value));
  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void controller.send();
    }
  });

  const render = (state: CopilotViewState) => {
    renderHeader(header, cn, state, controller);
    renderMessages(listEl, cn, state, suggestedPrompts, controller);
    textarea.value = state.input;
    textarea.disabled = state.busy;
    sendBtn.disabled = state.busy || !state.input.trim();
    sendBtn.textContent = state.busy ? 'Sending…' : sendLabel;
    clearBtn.disabled = state.busy || state.messages.length === 0;

    if (state.error) {
      errorEl.hidden = false;
      errorEl.replaceChildren();
      const msg = document.createElement('p');
      msg.textContent = friendlyCopilotError(state.error);
      const actions = document.createElement('div');
      actions.className = 'ab-copilot__error-actions';
      const retryBtn = document.createElement('button');
      retryBtn.type = 'button';
      retryBtn.className = cn.button;
      retryBtn.textContent = 'Try again';
      retryBtn.disabled = state.busy;
      retryBtn.addEventListener('click', () => void controller.retryLast());
      const dismissBtn = document.createElement('button');
      dismissBtn.type = 'button';
      dismissBtn.className = cn.buttonSecondary;
      dismissBtn.textContent = 'Dismiss';
      dismissBtn.disabled = state.busy;
      dismissBtn.addEventListener('click', () => controller.dismissError());
      actions.append(retryBtn, dismissBtn);
      errorEl.append(msg, actions);
    } else {
      errorEl.hidden = true;
      errorEl.replaceChildren();
    }

    if (wasBusy && !state.busy) {
      textarea.focus();
    }
    wasBusy = state.busy;

    listEl.scrollTop = listEl.scrollHeight;
  };

  const unsub = controller.subscribe(render);
  return { root, controller, listEl, textarea, unsub };
}

function renderHeader(
  header: HTMLElement,
  cn: typeof headlessCopilotPreset,
  state: CopilotViewState,
  controller: CopilotController,
): void {
  const badgeProviderId =
    state.providerId ?? state.selectedProviderId ?? state.connectedProviders[0]?.id;
  const badgeLabel =
    state.activeProviderLabel ??
    (badgeProviderId
      ? state.connectedProviders.find((p) => p.id === badgeProviderId)?.label ?? null
      : null);

  header.replaceChildren();

  const top = document.createElement('div');
  top.className = 'ab-copilot__header-top';

  const copy = document.createElement('div');
  copy.className = 'ab-copilot__header-copy';
  copy.innerHTML = `<h3 class="${cn.title}">${escapeHtml(state.title)}</h3>
    <p class="${cn.subtitle}">${escapeHtml(state.subtitle)}</p>`;
  top.appendChild(copy);

  if (badgeProviderId && badgeLabel) {
    const badge = document.createElement('div');
    badge.className = 'ab-copilot__provider-badge';
    badge.title = badgeLabel;
    badge.innerHTML = `<span class="ab-copilot__provider-icon" aria-hidden>${providerIconLabel(badgeProviderId)}</span>
      <span class="ab-copilot__provider-name">${escapeHtml(badgeLabel)}</span>`;
    top.appendChild(badge);
  }

  header.appendChild(top);

  if (!state.providerLocked && state.connectedProviders.length > 1) {
    const label = document.createElement('label');
    label.className = 'ab-copilot__provider-picker';
    const span = document.createElement('span');
    span.className = 'ab-copilot__provider-picker-label';
    span.textContent = 'Reply via';
    const select = document.createElement('select');
    select.className = 'ab-copilot__provider-select';
    select.disabled = state.busy;
    for (const provider of state.connectedProviders) {
      const opt = document.createElement('option');
      opt.value = provider.id;
      opt.textContent = provider.label;
      if (state.selectedProviderId === provider.id) opt.selected = true;
      select.appendChild(opt);
    }
    select.addEventListener('change', () => controller.setProvider(select.value as ProviderId));
    label.append(span, select);
    header.appendChild(label);
  }
}

function renderMessages(
  listEl: HTMLElement,
  cn: typeof headlessCopilotPreset,
  state: CopilotViewState,
  suggestedPrompts: readonly string[],
  controller: CopilotController,
): void {
  listEl.replaceChildren();

  const isMicrosoft =
    state.selectedProviderId === 'microsoft_copilot' ||
    state.providerId === 'microsoft_copilot' ||
    (state.providerLocked && state.connectedProviders[0]?.id === 'microsoft_copilot');

  if (state.messages.length === 0) {
    const empty = document.createElement('div');
    empty.className = cn.empty;
    empty.innerHTML = `<span class="ab-copilot__empty-icon" aria-hidden>${isMicrosoft ? 'MS' : '✦'}</span>
      <p class="ab-copilot__empty-title">${isMicrosoft ? 'Ask Microsoft Copilot' : 'Start a conversation'}</p>
      <p class="ab-copilot__empty-hint">${isMicrosoft ? 'Ask Microsoft Copilot using your work account — not the app host.' : 'Replies use your connected provider. You control the account and the spend.'}</p>`;
    if (suggestedPrompts.length > 0) {
      const prompts = document.createElement('div');
      prompts.className = 'ab-copilot__prompts';
      prompts.setAttribute('role', 'group');
      prompts.setAttribute('aria-label', 'Suggested prompts');
      for (const prompt of suggestedPrompts) {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'ab-copilot__prompt-chip';
        chip.textContent = prompt;
        chip.disabled = state.busy;
        chip.addEventListener('click', () => void controller.sendPrompt(prompt));
        prompts.appendChild(chip);
      }
      empty.appendChild(prompts);
    }
    listEl.appendChild(empty);
    return;
  }

  const lastMessage = state.messages[state.messages.length - 1];
  const showTyping =
    state.busy && lastMessage?.role === 'assistant' && !lastMessage.content.trim();

  for (const msg of state.messages) {
    const article = document.createElement('article');
    article.className = msg.role === 'user' ? cn.messageUser : cn.messageAssistant;

    const role = document.createElement('span');
    role.className = cn.messageRole;
    if (msg.role === 'user') {
      role.textContent = 'You';
    } else if (msg.providerId) {
      role.textContent =
        state.connectedProviders.find((p) => p.id === msg.providerId)?.label ?? msg.providerId;
    } else {
      role.textContent = 'Assistant';
    }

    const content = document.createElement('div');
    content.className = cn.messageContent;
    if (showTyping && msg.id === lastMessage?.id) {
      content.innerHTML = `<span class="ab-copilot__typing" aria-label="Thinking"><span></span><span></span><span></span></span>`;
    } else {
      content.textContent = msg.content || '';
    }

    article.append(role, content);
    listEl.appendChild(article);
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function unmountCopilotView(ctx: CopilotRenderContext | undefined): void {
  ctx?.unsub?.();
  ctx?.controller.destroy();
}
