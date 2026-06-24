/** Self-contained Account Bridge theme — works without Tailwind. Import once in host or demo. */
export const accountBridgeThemeCss = `
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap');

.ab-theme {
  --ab-font: 'Plus Jakarta Sans', ui-sans-serif, system-ui, -apple-system, sans-serif;
  --ab-radius: 16px;
  --ab-radius-sm: 10px;
  --ab-radius-lg: 20px;
  --ab-gap: 1rem;
  --ab-transition: 180ms cubic-bezier(0.4, 0, 0.2, 1);
  font-family: var(--ab-font);
  color: var(--ab-text);
  -webkit-font-smoothing: antialiased;
  letter-spacing: -0.01em;
}

.ab-theme-light {
  --ab-bg: #f4f6fa;
  --ab-surface: #ffffff;
  --ab-surface-elevated: #ffffff;
  --ab-border-color: rgba(15, 23, 42, 0.08);
  --ab-text: #0f172a;
  --ab-muted: #64748b;
  --ab-primary: #4f46e5;
  --ab-primary-hover: #4338ca;
  --ab-primary-fg: #ffffff;
  --ab-accent: #059669;
  --ab-accent-soft: rgba(5, 150, 105, 0.1);
  --ab-destructive: #dc2626;
  --ab-muted-bg: rgba(15, 23, 42, 0.04);
  --ab-input-bg: #ffffff;
  --ab-shadow: 0 1px 2px rgba(15, 23, 42, 0.04), 0 8px 32px rgba(15, 23, 42, 0.06);
  --ab-shadow-lg: 0 20px 50px rgba(15, 23, 42, 0.1);
}

.ab-theme-dark {
  --ab-bg: #0a0d12;
  --ab-surface: #121820;
  --ab-surface-elevated: #171e28;
  --ab-border-color: rgba(255, 255, 255, 0.07);
  --ab-text: #f1f5f9;
  --ab-muted: #94a3b8;
  --ab-primary: #818cf8;
  --ab-primary-hover: #a5b4fc;
  --ab-primary-fg: #0f172a;
  --ab-accent: #34d399;
  --ab-accent-soft: rgba(52, 211, 153, 0.12);
  --ab-destructive: #fca5a5;
  --ab-muted-bg: rgba(255, 255, 255, 0.04);
  --ab-input-bg: rgba(0, 0, 0, 0.2);
  --ab-shadow: 0 2px 8px rgba(0, 0, 0, 0.25), 0 12px 40px rgba(0, 0, 0, 0.2);
  --ab-shadow-lg: 0 24px 64px rgba(0, 0, 0, 0.45);
}

.ab-theme-dark.ab-theme {
  background:
    radial-gradient(ellipse 80% 50% at 50% -20%, rgba(129, 140, 248, 0.12), transparent),
    var(--ab-bg);
}

.ab-theme-light.ab-theme {
  background:
    radial-gradient(ellipse 80% 50% at 50% -20%, rgba(79, 70, 229, 0.08), transparent),
    var(--ab-bg);
}

/* ── Settings ── */
.ab-settings {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.ab-settings__intro-title {
  margin: 0;
  font-size: 1.375rem;
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.25;
}

.ab-settings__intro-description {
  margin: 0.625rem 0 0;
  color: var(--ab-muted);
  font-size: 0.9375rem;
  line-height: 1.6;
  max-width: 36rem;
}

.ab-settings__trust {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  margin: 1rem 0 0;
  padding: 0.625rem 0.875rem;
  border-radius: var(--ab-radius-sm);
  background: var(--ab-accent-soft);
  border: 1px solid color-mix(in srgb, var(--ab-accent) 22%, transparent);
  color: color-mix(in srgb, var(--ab-text) 88%, var(--ab-accent));
  font-size: 0.8125rem;
  line-height: 1.5;
  max-width: 36rem;
}

.ab-settings__trust-icon {
  color: var(--ab-accent);
  font-size: 0.625rem;
  line-height: 1.8;
  flex-shrink: 0;
}

.ab-settings__notice {
  margin: 0;
  padding: 0.625rem 0.875rem;
  border-radius: var(--ab-radius-sm);
  background: var(--ab-accent-soft);
  border: 1px solid color-mix(in srgb, var(--ab-accent) 25%, transparent);
  color: color-mix(in srgb, var(--ab-text) 90%, var(--ab-accent));
  font-size: 0.8125rem;
  font-weight: 500;
  animation: ab-fade-in 0.2s ease-out;
}

.ab-settings__status-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 0.75rem;
  padding: 0.625rem 0.875rem;
  border-radius: var(--ab-radius-sm);
  border: 1px solid color-mix(in srgb, var(--ab-accent) 22%, var(--ab-border-color));
  background: var(--ab-accent-soft);
}

.ab-settings__status-dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 9999px;
  background: var(--ab-accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--ab-accent) 25%, transparent);
}

.ab-settings__status-text {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--ab-text);
}

.ab-settings__status-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  margin-left: auto;
}

.ab-settings__status-pill {
  padding: 0.2rem 0.5rem;
  border-radius: 9999px;
  border: 1px solid var(--ab-border-color);
  background: var(--ab-surface);
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--ab-muted);
}

.ab-settings__section {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.ab-settings__section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
}

.ab-settings__section-label {
  margin: 0;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--ab-text);
  letter-spacing: -0.01em;
}

.ab-settings__section-meta {
  font-size: 0.8125rem;
  color: var(--ab-muted);
}

.ab-settings__default-card {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem 1.125rem;
  border-radius: var(--ab-radius);
  border: 1px solid var(--ab-border-color);
  background: var(--ab-surface-elevated);
}

.ab-settings__default-label {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--ab-text);
}

.ab-settings__select {
  appearance: none;
  width: 100%;
  max-width: 16rem;
  padding: 0.625rem 2rem 0.625rem 0.875rem;
  border-radius: var(--ab-radius-sm);
  border: 1px solid var(--ab-border-color);
  background: var(--ab-input-bg) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%238b9cb3' d='M3 4.5 6 7.5 9 4.5'/%3E%3C/svg%3E") no-repeat right 0.75rem center;
  color: var(--ab-text);
  font: inherit;
  font-size: 0.9375rem;
  cursor: pointer;
  transition: border-color var(--ab-transition), box-shadow var(--ab-transition);
}

.ab-settings__select:focus {
  outline: none;
  border-color: var(--ab-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--ab-primary) 25%, transparent);
}

.ab-settings__grid {
  display: grid;
  gap: 0.75rem;
}

.ab-settings__card {
  border: 1px solid var(--ab-border-color);
  border-radius: var(--ab-radius);
  padding: 1.125rem 1.25rem;
  background: var(--ab-surface-elevated);
  box-shadow: var(--ab-shadow);
  transition: border-color var(--ab-transition), box-shadow var(--ab-transition), transform var(--ab-transition);
}

.ab-settings__card:hover {
  border-color: color-mix(in srgb, var(--ab-primary) 28%, var(--ab-border-color));
}

.ab-settings__card--connected {
  border-color: color-mix(in srgb, var(--ab-accent) 35%, var(--ab-border-color));
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--ab-accent) 15%, transparent), var(--ab-shadow);
}

.ab-settings__card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 0.875rem;
}

.ab-settings__card-brand {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  min-width: 0;
}

.ab-settings__card-icon {
  flex-shrink: 0;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: -0.03em;
  border: 1px solid var(--ab-border-color);
}

.ab-settings__card-meta {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  min-width: 0;
}

.ab-settings__card-title {
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  line-height: 1.25;
}

.ab-settings__status-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  width: fit-content;
  padding: 0.2rem 0.625rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
  line-height: 1.4;
}

.ab-settings__status-badge::before {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.ab-settings__status-badge--connected {
  background: var(--ab-accent-soft);
  color: var(--ab-accent);
}

.ab-settings__status-badge--connected::before {
  background: var(--ab-accent);
  box-shadow: 0 0 8px var(--ab-accent);
}

.ab-settings__status-badge--disconnected {
  background: var(--ab-muted-bg);
  color: var(--ab-muted);
}

.ab-settings__status-badge--disconnected::before {
  background: var(--ab-muted);
  opacity: 0.6;
}

.ab-settings__card-actions,
.ab-settings__card-actions-column,
.ab-settings__key-form {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}

.ab-settings__card-actions-column {
  flex-direction: column;
  align-items: stretch;
}

.ab-settings__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.375rem;
  padding: 0.5625rem 1.125rem;
  border-radius: 9999px;
  border: none;
  background: var(--ab-primary);
  color: var(--ab-primary-fg);
  font: inherit;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: background var(--ab-transition), transform var(--ab-transition), opacity var(--ab-transition), box-shadow var(--ab-transition);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
}

.ab-settings__button:hover:not(:disabled) {
  background: var(--ab-primary-hover);
}

.ab-settings__button:active:not(:disabled) {
  transform: scale(0.98);
}

.ab-settings__button--secondary,
.ab-settings__button--oauth {
  background: transparent;
  color: var(--ab-text);
  border: 1px solid var(--ab-border-color);
  box-shadow: none;
  border-radius: 9999px;
}

.ab-settings__button--secondary:hover:not(:disabled),
.ab-settings__button--oauth:hover:not(:disabled) {
  background: var(--ab-muted-bg);
  border-color: color-mix(in srgb, var(--ab-primary) 40%, var(--ab-border-color));
}

.ab-settings__button--oauth {
  background: var(--ab-muted-bg);
}

.ab-settings__button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.ab-settings__input {
  flex: 1;
  min-width: 12rem;
  padding: 0.625rem 0.875rem;
  border-radius: var(--ab-radius-sm);
  border: 1px solid var(--ab-border-color);
  background: var(--ab-input-bg);
  color: var(--ab-text);
  font: inherit;
  font-size: 0.875rem;
  transition: border-color var(--ab-transition), box-shadow var(--ab-transition);
}

.ab-settings__input:focus {
  outline: none;
  border-color: var(--ab-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--ab-primary) 20%, transparent);
}

.ab-settings__input::placeholder {
  color: var(--ab-muted);
}

.ab-settings__link {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  color: var(--ab-primary);
  font-size: 0.8125rem;
  font-weight: 500;
  text-decoration: none;
  transition: opacity var(--ab-transition);
}

.ab-settings__link:hover {
  opacity: 0.85;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.ab-settings__error {
  margin: 0.5rem 0 0;
  padding: 0.625rem 0.875rem;
  border-radius: var(--ab-radius-sm);
  background: color-mix(in srgb, var(--ab-destructive) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--ab-destructive) 30%, transparent);
  color: var(--ab-destructive);
  font-size: 0.8125rem;
}

.ab-settings__muted {
  color: var(--ab-muted);
  font-size: 0.8125rem;
}

.ab-settings__key-form {
  margin-top: 0.25rem;
  padding-top: 0.75rem;
  border-top: 1px solid var(--ab-border-color);
}

.ab-settings__loading {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 2rem;
  align-items: center;
  color: var(--ab-muted);
  font-size: 0.875rem;
}

.ab-settings__loading-dots {
  display: flex;
  gap: 0.375rem;
}

.ab-settings__loading-dots span {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--ab-primary);
  animation: ab-pulse 1.2s ease-in-out infinite;
}

.ab-settings__loading-dots span:nth-child(2) { animation-delay: 0.15s; }
.ab-settings__loading-dots span:nth-child(3) { animation-delay: 0.3s; }

.ab-settings--compact {
  gap: 0.875rem;
}

.ab-settings--compact .ab-settings__intro-title {
  font-size: 1.0625rem;
}

.ab-settings--compact .ab-settings__intro-description {
  font-size: 0.8125rem;
}

.ab-settings--compact .ab-settings__trust {
  padding: 0.5rem 0.75rem;
  font-size: 0.75rem;
}

.ab-settings--compact .ab-settings__card {
  padding: 0.875rem;
}

.ab-settings--compact .ab-settings__grid {
  gap: 0.625rem;
}

@keyframes ab-pulse {
  0%, 80%, 100% { opacity: 0.3; transform: scale(0.85); }
  40% { opacity: 1; transform: scale(1); }
}

/* Provider icon tints */
.ab-settings__card-icon--openai { background: linear-gradient(135deg, #10a37f22, #10a37f44); color: #10a37f; }
.ab-settings__card-icon--anthropic { background: linear-gradient(135deg, #d9775722, #d9775744); color: #d97757; }
.ab-settings__card-icon--gemini { background: linear-gradient(135deg, #4285f422, #ea433544); color: #8ab4f8; }
.ab-settings__card-icon--microsoft_copilot { background: linear-gradient(135deg, #0078d422, #00bcf244); color: #60cdff; }
.ab-settings__card-icon--groq { background: linear-gradient(135deg, #f5503622, #f5503644); color: #f55036; }
.ab-settings__card-icon--together { background: linear-gradient(135deg, #6366f122, #6366f144); color: #818cf8; }
.ab-settings__card-icon--mistral { background: linear-gradient(135deg, #ff700022, #ff700044); color: #ff7000; }
.ab-settings__card-icon--ollama { background: linear-gradient(135deg, #ffffff11, #ffffff22); color: var(--ab-text); }

/* ── Copilot ── */
.ab-copilot {
  display: flex;
  flex-direction: column;
  min-height: 20rem;
  border: 1px solid var(--ab-border-color);
  border-radius: var(--ab-radius);
  background: var(--ab-surface-elevated);
  box-shadow: var(--ab-shadow);
  overflow: hidden;
}

.ab-copilot__header {
  padding: 1.125rem 1.25rem 0.75rem;
  border-bottom: 1px solid var(--ab-border-color);
  background: linear-gradient(180deg, var(--ab-muted-bg) 0%, transparent 100%);
}

.ab-copilot__header-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.ab-copilot__header-copy {
  min-width: 0;
  flex: 1;
}

.ab-copilot__provider-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  flex-shrink: 0;
  padding: 0.35rem 0.625rem 0.35rem 0.4rem;
  border-radius: 9999px;
  border: 1px solid var(--ab-border-color);
  background: var(--ab-surface);
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--ab-muted);
  max-width: 9rem;
}

.ab-copilot__provider-icon {
  width: 1.375rem;
  height: 1.375rem;
  font-size: 0.625rem;
}

.ab-copilot__provider-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ab-copilot__provider-picker {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: 0.75rem;
  font-size: 0.8125rem;
}

.ab-copilot__provider-picker-label {
  color: var(--ab-muted);
  font-weight: 500;
}

.ab-copilot__provider-select {
  flex: 1;
  min-width: 0;
  padding: 0.4375rem 0.625rem;
  border-radius: var(--ab-radius-sm);
  border: 1px solid var(--ab-border-color);
  background: var(--ab-input-bg);
  color: var(--ab-text);
  font: inherit;
  font-size: 0.8125rem;
}

.ab-copilot__provider-select:focus {
  outline: none;
  border-color: var(--ab-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--ab-primary) 20%, transparent);
}

.ab-copilot__title {
  margin: 0;
  font-size: 1.0625rem;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.ab-copilot__subtitle {
  margin: 0.35rem 0 0;
  font-size: 0.8125rem;
  color: var(--ab-muted);
  line-height: 1.45;
}

.ab-copilot__messages {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
  max-height: 22rem;
  overflow-y: auto;
  padding: 1rem 1.25rem;
  scroll-behavior: smooth;
}

.ab-copilot__messages::-webkit-scrollbar { width: 6px; }
.ab-copilot__messages::-webkit-scrollbar-thumb {
  background: var(--ab-border-color);
  border-radius: 3px;
}

.ab-copilot__message {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  max-width: 88%;
  padding: 0.75rem 1rem;
  border-radius: var(--ab-radius);
  font-size: 0.9375rem;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
}

.ab-copilot__message-role {
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--ab-muted);
}

.ab-copilot__message--user {
  align-self: flex-end;
  background: var(--ab-primary);
  color: var(--ab-primary-fg);
  border-bottom-right-radius: 4px;
}

.ab-copilot__message--user .ab-copilot__message-role {
  color: color-mix(in srgb, var(--ab-primary-fg) 70%, transparent);
}

.ab-copilot__message--assistant {
  align-self: flex-start;
  background: var(--ab-muted-bg);
  border: 1px solid var(--ab-border-color);
  border-bottom-left-radius: 4px;
}

.ab-copilot__composer {
  border-top: 1px solid var(--ab-border-color);
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  background: var(--ab-surface);
}

.ab-copilot__textarea {
  width: 100%;
  min-height: 4.5rem;
  padding: 0.75rem 1rem;
  border-radius: var(--ab-radius-sm);
  border: 1px solid var(--ab-border-color);
  background: var(--ab-input-bg);
  color: var(--ab-text);
  font: inherit;
  font-size: 0.9375rem;
  line-height: 1.5;
  resize: vertical;
  transition: border-color var(--ab-transition), box-shadow var(--ab-transition);
}

.ab-copilot__textarea:focus {
  outline: none;
  border-color: var(--ab-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--ab-primary) 20%, transparent);
}

.ab-copilot__textarea::placeholder {
  color: var(--ab-muted);
}

.ab-copilot__toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.ab-copilot__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 1.125rem;
  border-radius: 9999px;
  border: none;
  background: var(--ab-primary);
  color: var(--ab-primary-fg);
  font: inherit;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: background var(--ab-transition), opacity var(--ab-transition), transform var(--ab-transition);
}

.ab-copilot__button:hover:not(:disabled) { background: var(--ab-primary-hover); }
.ab-copilot__button--secondary {
  background: transparent;
  color: var(--ab-text);
  border: 1px solid var(--ab-border-color);
  font-weight: 500;
}
.ab-copilot__button--secondary:hover:not(:disabled) { background: var(--ab-muted-bg); }
.ab-copilot__button:disabled { opacity: 0.45; cursor: not-allowed; }

.ab-copilot__error {
  margin: 0 1.25rem;
  padding: 0.625rem 0.875rem;
  border-radius: var(--ab-radius-sm);
  background: color-mix(in srgb, var(--ab-destructive) 12%, transparent);
  color: var(--ab-destructive);
  font-size: 0.8125rem;
}

.ab-copilot__empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 2.5rem 1.5rem;
  text-align: center;
  color: var(--ab-muted);
  font-size: 0.875rem;
  line-height: 1.5;
}

.ab-copilot__empty-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--ab-text);
  letter-spacing: -0.02em;
}

.ab-copilot__empty-hint {
  margin: 0;
  max-width: 16rem;
  font-size: 0.8125rem;
  line-height: 1.55;
  color: var(--ab-muted);
}

.ab-copilot__empty-icon {
  width: 3rem;
  height: 3rem;
  margin-bottom: 0.25rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(145deg, color-mix(in srgb, var(--ab-primary) 18%, transparent), var(--ab-muted-bg));
  border: 1px solid color-mix(in srgb, var(--ab-primary) 25%, var(--ab-border-color));
  font-size: 1.125rem;
  color: var(--ab-primary);
}

.ab-copilot__prompts {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.5rem;
  margin-top: 0.75rem;
  max-width: 20rem;
}

.ab-copilot__prompt-chip {
  padding: 0.4375rem 0.75rem;
  border-radius: 9999px;
  border: 1px solid var(--ab-border-color);
  background: var(--ab-surface);
  color: var(--ab-text);
  font: inherit;
  font-size: 0.75rem;
  font-weight: 500;
  cursor: pointer;
  transition: border-color var(--ab-transition), background var(--ab-transition), transform var(--ab-transition);
}

.ab-copilot__prompt-chip:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--ab-primary) 40%, var(--ab-border-color));
  background: var(--ab-muted-bg);
  transform: translateY(-1px);
}

.ab-copilot__prompt-chip:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.ab-copilot__typing {
  display: inline-flex;
  gap: 4px;
  padding: 0.25rem 0;
}

.ab-copilot__typing span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--ab-muted);
  animation: ab-pulse 1.2s ease-in-out infinite;
}

.ab-copilot__typing span:nth-child(2) { animation-delay: 0.15s; }
.ab-copilot__typing span:nth-child(3) { animation-delay: 0.3s; }

.ab-copilot__fab {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  z-index: 52;
  width: 3.25rem;
  height: 3.25rem;
  border-radius: 9999px;
  border: 1px solid color-mix(in srgb, var(--ab-primary) 50%, transparent);
  background: linear-gradient(145deg, var(--ab-primary), color-mix(in srgb, var(--ab-primary) 80%, #000));
  color: var(--ab-primary-fg);
  box-shadow: var(--ab-shadow-lg);
  cursor: pointer;
  font-size: 1.25rem;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform var(--ab-transition), box-shadow var(--ab-transition), background var(--ab-transition);
}

.ab-copilot__fab:hover {
  transform: scale(1.05);
  box-shadow: 0 20px 40px color-mix(in srgb, var(--ab-primary) 35%, transparent);
}

.ab-copilot__fab--open {
  background: var(--ab-surface-elevated);
  color: var(--ab-text);
  border-color: var(--ab-border-color);
  font-size: 1.5rem;
  font-weight: 300;
}

.ab-copilot__fab--open:hover {
  transform: scale(1.02);
  box-shadow: var(--ab-shadow);
}

.ab-copilot__backdrop {
  position: fixed;
  inset: 0;
  z-index: 51;
  border: none;
  padding: 0;
  margin: 0;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(4px);
  cursor: pointer;
  animation: ab-fade-in 0.2s ease-out;
}

@keyframes ab-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.ab-copilot__panel {
  position: fixed;
  bottom: 5.5rem;
  right: 1.5rem;
  z-index: 52;
  width: min(calc(100vw - 2rem), 26rem);
  max-height: min(72vh, 36rem);
  display: flex;
  flex-direction: column;
  border-radius: var(--ab-radius);
  border: 1px solid var(--ab-border-color);
  background: var(--ab-surface-elevated);
  box-shadow: var(--ab-shadow-lg);
  overflow: hidden;
  animation: ab-slide-up 0.25s ease-out;
}

@keyframes ab-slide-up {
  from { opacity: 0; transform: translateY(12px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.ab-copilot__panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  border-bottom: 1px solid var(--ab-border-color);
  padding: 0.875rem 1rem;
  background: var(--ab-surface);
}

.ab-copilot__panel-header strong {
  font-size: 0.9375rem;
  font-weight: 600;
}

.ab-copilot__panel .ab-copilot {
  border: none;
  border-radius: 0;
  box-shadow: none;
  min-height: 18rem;
}

@media (max-width: 640px) {
  .ab-copilot__panel {
    left: 0;
    right: 0;
    bottom: 0;
    width: auto;
    max-height: min(88vh, 40rem);
    border-radius: var(--ab-radius-lg) var(--ab-radius-lg) 0 0;
    animation: ab-sheet-up 0.28s cubic-bezier(0.4, 0, 0.2, 1);
  }

  @keyframes ab-sheet-up {
    from { opacity: 0; transform: translateY(100%); }
    to { opacity: 1; transform: translateY(0); }
  }

  .ab-copilot__fab {
    bottom: 1rem;
    right: 1rem;
  }
}

/* ── Credit gate ── */
.ab-gate {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.ab-gate__hero {
  text-align: center;
  padding: 1.25rem 1rem 0.25rem;
}

.ab-gate__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2.75rem;
  height: 2.75rem;
  margin-bottom: 0.75rem;
  border-radius: 50%;
  background: linear-gradient(145deg, color-mix(in srgb, var(--ab-primary) 20%, transparent), var(--ab-muted-bg));
  border: 1px solid color-mix(in srgb, var(--ab-primary) 30%, var(--ab-border-color));
  color: var(--ab-primary);
  font-size: 1rem;
}

.ab-gate__title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.ab-gate__text {
  margin: 0.375rem 0 0;
  font-size: 0.875rem;
  color: var(--ab-muted);
  line-height: 1.5;
}

.ab-gate__tabs {
  display: flex;
  gap: 0.5rem;
  margin: 1rem 0;
}

.ab-gate__tab {
  flex: 1;
  padding: 0.5rem 0.75rem;
  border-radius: 999px;
  border: 1px solid var(--ab-border-color);
  background: transparent;
  color: var(--ab-fg);
  font-size: 0.8125rem;
  cursor: pointer;
}

.ab-gate__tab--active {
  background: var(--ab-accent);
  color: var(--ab-accent-fg);
  border-color: transparent;
}

.ab-wallet {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.ab-wallet__balance {
  padding: 1rem;
  border-radius: var(--ab-radius);
  border: 1px solid var(--ab-border-color);
  background: var(--ab-card-bg);
}

.ab-wallet__label {
  display: block;
  font-size: 0.75rem;
  color: var(--ab-muted);
}

.ab-wallet__amount {
  font-size: 1.5rem;
  font-weight: 700;
}

.ab-wallet__hint {
  margin: 0.5rem 0 0;
  font-size: 0.8125rem;
  color: var(--ab-muted);
}

.ab-wallet__packs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.ab-wallet__pack {
  padding: 0.5rem 1rem;
  border-radius: var(--ab-radius);
  border: 1px solid var(--ab-border-color);
  background: var(--ab-card-bg);
  cursor: pointer;
}

.ab-overlay-root {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  z-index: 9999;
}

.ab-overlay-sheet {
  position: absolute;
  bottom: 3.5rem;
  right: 0;
  width: min(22rem, calc(100vw - 2rem));
  padding: 1rem;
  border-radius: var(--ab-radius);
  border: 1px solid var(--ab-border-color);
  background: var(--ab-card-bg);
  box-shadow: var(--ab-shadow-lg);
}

.ab-embed {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  max-width: 40rem;
}

.ab-embed__section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding-bottom: 2rem;
  border-bottom: 1px solid var(--ab-border-color);
}

.ab-embed__section:last-of-type {
  border-bottom: none;
  padding-bottom: 0;
}

.ab-embed__heading {
  margin: 0;
  font-size: 0.6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--ab-muted);
}

.ab-embed__lede {
  margin: -0.25rem 0 0.5rem;
  font-size: 0.875rem;
  color: var(--ab-muted);
  line-height: 1.5;
}

/* ── Settings onboarding ── */
.ab-settings__onboarding {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  padding: 1rem 1.125rem;
  border-radius: var(--ab-radius);
  border: 1px dashed color-mix(in srgb, var(--ab-primary) 35%, var(--ab-border-color));
  background: color-mix(in srgb, var(--ab-primary) 6%, var(--ab-surface));
}

.ab-settings__onboarding-title {
  margin: 0;
  font-size: 0.8125rem;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--ab-text);
}

.ab-settings__onboarding-steps {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ab-settings__onboarding-step {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}

.ab-settings__onboarding-num {
  flex-shrink: 0;
  width: 1.625rem;
  height: 1.625rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  background: var(--ab-primary);
  color: var(--ab-primary-fg);
  font-size: 0.75rem;
  font-weight: 700;
}

.ab-settings__onboarding-copy strong {
  display: block;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--ab-text);
  margin-bottom: 0.125rem;
}

.ab-settings__onboarding-copy span {
  font-size: 0.75rem;
  color: var(--ab-muted);
  line-height: 1.45;
}

.ab-settings__card--recommended {
  border-color: color-mix(in srgb, var(--ab-primary) 45%, var(--ab-border-color));
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--ab-primary) 12%, transparent);
}

.ab-settings__recommended-badge {
  display: inline-flex;
  margin-left: 0.375rem;
  padding: 0.125rem 0.4375rem;
  border-radius: 9999px;
  background: color-mix(in srgb, var(--ab-primary) 15%, transparent);
  color: var(--ab-primary);
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  vertical-align: middle;
}

.ab-settings--compact .ab-settings__onboarding {
  padding: 0.75rem;
  gap: 0.5rem;
}

/* ── Copilot composer hint + error card ── */
.ab-copilot__composer-hint {
  margin: 0;
  font-size: 0.6875rem;
  color: var(--ab-muted);
  text-align: right;
}

.ab-copilot__error-card {
  margin: 0 1.25rem;
  padding: 0.75rem 1rem;
  border-radius: var(--ab-radius-sm);
  background: color-mix(in srgb, var(--ab-destructive) 10%, var(--ab-surface));
  border: 1px solid color-mix(in srgb, var(--ab-destructive) 25%, transparent);
}

.ab-copilot__error-card p {
  margin: 0;
  color: var(--ab-destructive);
  font-size: 0.8125rem;
  line-height: 1.5;
}

.ab-copilot__error-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.625rem;
}

.ab-copilot__error-actions .ab-copilot__button,
.ab-copilot__error-actions .ab-copilot__button--secondary {
  padding: 0.375rem 0.875rem;
  font-size: 0.8125rem;
}

/* ── Embed waiting for connection ── */
.ab-embed__pending {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.375rem;
  padding: 2rem 1.5rem;
  text-align: center;
  border-radius: var(--ab-radius);
  border: 1px dashed var(--ab-border-color);
  background: var(--ab-muted-bg);
  color: var(--ab-muted);
  font-size: 0.875rem;
  line-height: 1.5;
}

.ab-embed__pending-icon {
  width: 2.5rem;
  height: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 9999px;
  background: var(--ab-surface);
  border: 1px solid var(--ab-border-color);
  color: var(--ab-primary);
  font-size: 1.125rem;
  animation: ab-bob 2s ease-in-out infinite;
}

.ab-embed__pending strong {
  color: var(--ab-text);
  font-size: 0.9375rem;
}

@keyframes ab-bob {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}

.ab-copilot__button:focus-visible,
.ab-copilot__button--secondary:focus-visible,
.ab-settings button:focus-visible,
.ab-settings a:focus-visible {
  outline: 2px solid var(--ab-primary);
  outline-offset: 2px;
}
`.trim();
