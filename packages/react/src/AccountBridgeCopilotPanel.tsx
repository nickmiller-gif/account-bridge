import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import {
  mergeCopilotClassNames,
  headlessCopilotPreset,
  shadcnCopilotPreset,
  type CopilotClassNames,
} from '@account-bridge/ui';

import type { FundingPolicy, ProviderId } from '@account-bridge/core';

import { AccountBridgeCopilot, type AccountBridgeCopilotProps } from './AccountBridgeCopilot.js';
import {
  AccountBridgeTheme,
  type AccountBridgeThemeSetting,
} from './AccountBridgeTheme.js';
import { ConsumerFundingGate } from './components.js';

export interface AccountBridgeCopilotPanelProps extends AccountBridgeCopilotProps {
  /** FAB label when closed (default ✦) */
  fabLabel?: ReactNode;
  /** Panel title when header is hidden inside copilot */
  panelTitle?: string;
  classNames?: Partial<CopilotClassNames>;
  /** Show settings gate inside panel when credits not ready */
  gateWithSettings?: boolean;
  /** Headless preset theme (default dark) */
  theme?: AccountBridgeThemeSetting;
  fundingPolicy?: FundingPolicy;
  baseUrl?: string;
  apiPrefix?: string;
  getAuthHeaders?: () => Promise<Record<string, string>> | Record<string, string>;
}

export function AccountBridgeCopilotPanel({
  fabLabel = '✦',
  panelTitle = 'Assistant',
  classNames,
  preset = 'shadcn',
  gateWithSettings = true,
  theme = 'dark',
  providerId,
  fundingPolicy = { mode: 'byok' },
  baseUrl,
  apiPrefix,
  getAuthHeaders,
  ...copilotProps
}: AccountBridgeCopilotPanelProps) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const cn = mergeCopilotClassNames(
    preset === 'shadcn' ? shadcnCopilotPreset : headlessCopilotPreset,
    classNames,
  );

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (!panel) return;
    const focusable = panel.querySelector<HTMLElement>(
      'button, textarea, input, [href], [tabindex]:not([tabindex="-1"])',
    );
    focusable?.focus();
  }, [open]);

  const copilot = (
    <AccountBridgeCopilot
      {...copilotProps}
      preset={preset}
      theme={theme}
      providerId={providerId}
      hideHeader
      className="ab-copilot--embedded"
    />
  );

  const panelBody = gateWithSettings ? (
    <ConsumerFundingGate
      providerId={providerId}
      settingsProps={{ preset, theme, compact: true }}
      fundingPolicy={fundingPolicy}
      baseUrl={baseUrl}
      apiPrefix={apiPrefix}
      getAuthHeaders={getAuthHeaders}
    >
      {copilot}
    </ConsumerFundingGate>
  ) : (
    copilot
  );

  const shell = (
    <>
      {open ? (
        <button
          type="button"
          className="ab-copilot__backdrop"
          aria-label="Close assistant"
          onClick={close}
        />
      ) : null}

      <button
        type="button"
        className={[cn.fab, open ? 'ab-copilot__fab--open' : ''].filter(Boolean).join(' ')}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={open ? 'Close assistant' : 'Open assistant'}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <span aria-hidden>×</span> : fabLabel}
      </button>

      {open ? (
        <div
          ref={panelRef}
          className={cn.panelOpen}
          role="dialog"
          aria-modal="true"
          aria-label={panelTitle}
        >
          <div className={cn.panelHeader}>
            <strong>{panelTitle}</strong>
            <button type="button" className={cn.buttonSecondary} onClick={close}>
              Close
            </button>
          </div>
          {panelBody}
        </div>
      ) : null}
    </>
  );

  if (preset === 'headless') {
    return <AccountBridgeTheme mode={theme}>{shell}</AccountBridgeTheme>;
  }

  return shell;
}
