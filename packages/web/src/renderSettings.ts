import type { ProviderId } from '@account-bridge/core';
import {
  headlessPreset,
  mergeClassNames,
  isRecommendedProvider,
  SETTINGS_ONBOARDING_STEPS,
  type SettingsController,
  type SettingsViewState,
} from '@account-bridge/ui';

import { providerIconLabel } from './theme.js';

export interface SettingsRenderContext {
  root: HTMLElement;
  controller: SettingsController;
  compact?: boolean;
  unsub?: () => void;
}

export function mountSettingsView(
  host: HTMLElement,
  controller: SettingsController,
  compact = false,
): SettingsRenderContext {
  const cn = headlessPreset;
  const root = document.createElement('div');
  root.className = [cn.root, compact ? 'ab-settings--compact' : ''].filter(Boolean).join(' ');
  host.replaceChildren(root);

  const render = (state: SettingsViewState) => {
    root.replaceChildren();

    if (state.loading && !state.providers) {
      const loading = document.createElement('div');
      loading.className = cn.loading;
      loading.textContent = 'Loading your providers…';
      root.appendChild(loading);
      return;
    }

    const intro = document.createElement('header');
    intro.className = cn.intro;
    intro.innerHTML = `<h3 class="${cn.introTitle}">${escapeHtml(state.introTitle)}</h3>
      <p class="${cn.introDescription}">${escapeHtml(state.introDescription)}</p>
      <p class="ab-settings__trust" role="note"><span class="ab-settings__trust-icon" aria-hidden>◆</span>
      Keys and tokens stay on your device. The host app never sees them.</p>`;
    root.appendChild(intro);

    if (state.notice) {
      const notice = document.createElement('p');
      notice.className = 'ab-settings__notice';
      notice.setAttribute('role', 'status');
      notice.textContent = state.notice;
      root.appendChild(notice);
    }

    const connectedCount = state.cards.filter((c) => c.connected).length;

    if (connectedCount === 0) {
      root.appendChild(buildOnboarding());
    }

    if (connectedCount > 0) {
      root.appendChild(buildStatusBar(state));
      root.appendChild(buildDefaultProvider(cn, state, controller));
    }

    const section = document.createElement('div');
    section.className = 'ab-settings__section';
    section.innerHTML = `<div class="ab-settings__section-head">
      <h4 class="ab-settings__section-label">Providers</h4>
      <span class="ab-settings__section-meta">${connectedCount > 0 ? `${connectedCount} connected` : 'Connect one to get started'}</span>
    </div>`;

    const grid = document.createElement('div');
    grid.className = cn.providerGrid;
    for (const card of state.cards) {
      grid.appendChild(buildProviderCard(cn, card, controller));
    }
    section.appendChild(grid);
    root.appendChild(section);
  };

  const unsub = controller.subscribe(render);
  return { root, controller, compact, unsub };
}

function buildOnboarding(): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'ab-settings__onboarding';
  wrap.setAttribute('aria-label', 'Getting started');
  const steps = SETTINGS_ONBOARDING_STEPS.map(
    (step) => `<li class="ab-settings__onboarding-step">
      <span class="ab-settings__onboarding-num" aria-hidden>${step.num}</span>
      <div class="ab-settings__onboarding-copy"><strong>${escapeHtml(step.title)}</strong><span>${escapeHtml(step.detail)}</span></div>
    </li>`,
  ).join('');
  wrap.innerHTML = `<p class="ab-settings__onboarding-title">Get started in 3 steps</p>
    <ol class="ab-settings__onboarding-steps">${steps}</ol>`;
  return wrap;
}

function buildStatusBar(state: SettingsViewState): HTMLElement {
  const bar = document.createElement('div');
  bar.className = 'ab-settings__status-bar';
  bar.setAttribute('role', 'status');
  const pills = state.connectedOptions
    .map((o) => `<span class="ab-settings__status-pill">${escapeHtml(o.label)}</span>`)
    .join('');
  bar.innerHTML = `<span class="ab-settings__status-dot" aria-hidden></span>
    <span class="ab-settings__status-text">${state.connectedOptions.length} provider${state.connectedOptions.length === 1 ? '' : 's'} ready</span>
    <div class="ab-settings__status-pills">${pills}</div>`;
  return bar;
}

function buildDefaultProvider(
  cn: ReturnType<typeof mergeClassNames>,
  state: SettingsViewState,
  controller: SettingsController,
): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = cn.defaultProviderCard;
  const label = document.createElement('label');
  label.className = cn.defaultProviderLabel;
  label.textContent = 'Preferred provider';
  const select = document.createElement('select');
  select.className = cn.select;
  select.innerHTML = `<option value="">Automatic — use any connected provider</option>`;
  for (const opt of state.connectedOptions) {
    const option = document.createElement('option');
    option.value = opt.id;
    option.textContent = opt.label;
    if (state.defaultProvider === opt.id) option.selected = true;
    select.appendChild(option);
  }
  select.addEventListener('change', () => {
    const value = select.value as ProviderId | '';
    void controller.setDefaultProvider(value || null);
  });
  label.appendChild(select);
  wrap.appendChild(label);
  return wrap;
}

function buildProviderCard(
  cn: ReturnType<typeof mergeClassNames>,
  card: SettingsViewState['cards'][number],
  controller: SettingsController,
): HTMLElement {
  const article = document.createElement('article');
  article.className = [
    cn.card,
    card.connected ? 'ab-settings__card--connected' : '',
    !card.connected && isRecommendedProvider(card.providerId) ? 'ab-settings__card--recommended' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const header = document.createElement('header');
  header.className = cn.cardHeader;
  header.innerHTML = `<div class="${cn.cardBrand}">
    <span class="${cn.cardIcon} ab-settings__provider-icon" aria-hidden>${providerIconLabel(card.providerId)}</span>
    <div class="${cn.cardMeta}">
      <strong class="${cn.cardTitle}">${escapeHtml(card.displayName)}${!card.connected && isRecommendedProvider(card.providerId) ? '<span class="ab-settings__recommended-badge">Recommended</span>' : ''}</strong>
      <span class="${card.connected ? cn.statusBadgeConnected : cn.statusBadgeDisconnected}">
        ${card.connected ? 'Ready to use' : 'Not connected yet'}
      </span>
    </div>
  </div>`;
  article.appendChild(header);

  const actions = document.createElement('div');
  actions.className = card.connected ? cn.cardActions : cn.cardActionsColumn;

  if (card.connected) {
    if (card.error) {
      const err = document.createElement('p');
      err.className = cn.error;
      err.setAttribute('role', 'alert');
      err.textContent = card.error;
      actions.appendChild(err);
    }
    if (card.supportsOAuth && card.oauthProviderKey && card.error?.toLowerCase().includes('reconnect')) {
      actions.appendChild(
        button('Reconnect', cn.buttonOAuth, () =>
          void controller.startOAuth(card.providerId, card.oauthProviderKey!),
        ),
      );
    }
    actions.appendChild(
      button('Test connection', cn.buttonSecondary, () => void controller.testConnection(card.providerId)),
    );
    actions.appendChild(
      button('Disconnect', cn.buttonSecondary, () => void controller.disconnect(card.providerId)),
    );
    if (card.testResult) {
      const span = document.createElement('span');
      span.className = cn.muted;
      span.textContent = card.testResult;
      actions.appendChild(span);
    }
  } else {
    const row = document.createElement('div');
    row.className = cn.cardActions;
    if (card.supportsOAuth && card.oauthProviderKey) {
      row.appendChild(
        button(card.oauthButtonLabel, cn.buttonOAuth, () =>
          void controller.startOAuth(card.providerId, card.oauthProviderKey!),
        ),
      );
    }
    if (card.supportsApiKey) {
      row.appendChild(
        button(card.keyFormExpanded ? 'Cancel' : 'Use API key instead', cn.buttonSecondary, () =>
          controller.toggleKeyForm(card.providerId),
        ),
      );
    }
    if (card.helpUrl) {
      const link = document.createElement('a');
      link.className = cn.link;
      link.href = card.helpUrl;
      link.target = '_blank';
      link.rel = 'noreferrer';
      link.textContent = 'Where do I get a key?';
      row.appendChild(link);
    }
    actions.appendChild(row);

    if (card.supportsApiKey && card.keyFormExpanded) {
      const form = document.createElement('div');
      form.className = cn.keyForm;
      const input = document.createElement('input');
      input.type = 'password';
      input.className = cn.input;
      input.placeholder = 'Paste API key';
      input.value = card.apiKeyValue;
      input.autocomplete = 'off';
      input.disabled = card.busy;
      input.addEventListener('input', () => controller.setApiKey(card.providerId, input.value));
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && input.value.trim() && !card.busy) {
          e.preventDefault();
          void controller.connectWithApiKey(card.providerId);
        }
      });
      form.appendChild(input);
      form.appendChild(
        button('Connect', cn.button, () => void controller.connectWithApiKey(card.providerId), card.busy),
      );
      if (card.error) {
        const err = document.createElement('p');
        err.className = cn.error;
        err.textContent = card.error;
        form.appendChild(err);
      }
      actions.appendChild(form);
    } else if (card.error) {
      const err = document.createElement('p');
      err.className = cn.error;
      err.textContent = card.error;
      actions.appendChild(err);
    }
  }

  article.appendChild(actions);
  return article;
}

function button(
  label: string,
  className: string,
  onClick: () => void,
  disabled = false,
): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = className;
  btn.textContent = label;
  btn.disabled = disabled;
  btn.addEventListener('click', onClick);
  return btn;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function unmountSettingsView(ctx: SettingsRenderContext | undefined): void {
  ctx?.unsub?.();
  ctx?.controller.destroy();
}
