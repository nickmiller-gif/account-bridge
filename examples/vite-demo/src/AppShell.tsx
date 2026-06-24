import { useMemo, type ReactNode } from 'react';

import {
  useResolvedThemeMode,
  type AccountBridgeEmbedMode,
  type AccountBridgeThemeSetting,
} from '@account-bridge/react';

import { WalkthroughPanel } from './WalkthroughPanel.js';
import {
  WALKTHROUGH_SCENARIOS,
  type WalkthroughScenario,
  type WalkthroughScenarioId,
} from './walkthrough.js';

export const DEMO_MODES: { id: AccountBridgeEmbedMode; label: string; hint: string }[] = [
  { id: 'settings', label: 'Settings', hint: 'Provider cards only' },
  { id: 'gate', label: 'Gate', hint: 'Unlock a feature' },
  { id: 'copilot', label: 'Chat', hint: 'Inline assistant' },
  { id: 'panel', label: 'Panel', hint: 'FAB + sheet' },
  { id: 'full', label: 'Full', hint: 'Settings + chat + FAB' },
];

export type DemoTransport = 'local' | 'remote';
export type DemoProviderPreset = 'api' | 'microsoft' | 'all' | 'wallet' | 'platform';

interface RemoteHealth {
  ok: boolean;
  microsoftOAuth?: boolean;
}

interface WalletHealth {
  ok: boolean;
  demoMockAi?: boolean;
}

export interface AppShellProps {
  children: ReactNode;
  mode: AccountBridgeEmbedMode;
  onModeChange: (mode: AccountBridgeEmbedMode) => void;
  theme: AccountBridgeThemeSetting;
  onThemeChange: (theme: AccountBridgeThemeSetting) => void;
  transport: DemoTransport;
  onTransportChange: (transport: DemoTransport) => void;
  preset: DemoProviderPreset;
  onPresetChange: (preset: DemoProviderPreset) => void;
  remoteHealth: RemoteHealth | null;
  walletHealth: WalletHealth | null;
  remoteBaseUrl: string;
  scenario: WalkthroughScenario;
  walkthroughStep: number;
  onWalkthroughStepChange: (step: number) => void;
  onScenarioSelect: (id: WalkthroughScenarioId) => void;
  scenarioBlocked?: boolean;
  platformServiceReady?: boolean;
}

export function AppShell({
  children,
  mode,
  onModeChange,
  theme,
  onThemeChange,
  transport,
  onTransportChange,
  preset,
  onPresetChange,
  remoteHealth,
  walletHealth,
  remoteBaseUrl,
  scenario,
  walkthroughStep,
  onWalkthroughStepChange,
  onScenarioSelect,
  scenarioBlocked = false,
  platformServiceReady = false,
}: AppShellProps) {
  const activeMode = DEMO_MODES.find((item) => item.id === mode);
  const resolvedTheme = useResolvedThemeMode(theme);
  const shellClass = useMemo(
    () => `host-app host-app--${resolvedTheme}${theme === 'auto' ? ' host-app--auto' : ''}`,
    [resolvedTheme, theme],
  );

  const remoteReady = remoteHealth?.ok === true;
  const microsoftReady = remoteHealth?.microsoftOAuth === true;
  const walletReady = walletHealth?.ok === true;

  return (
    <div className={shellClass}>
      <aside className="host-sidebar">
        <div className="host-brand">
          <div className="host-logo">
            <span className="host-logo-mark" aria-hidden>
              ✦
            </span>
            Account Bridge
            <span className="host-version">walkthrough</span>
          </div>
          <p className="host-tagline">
            Guided demo — pick a scenario, follow the steps, try each embed mode.
          </p>
        </div>

        <WalkthroughPanel
          scenario={scenario}
          activeStep={walkthroughStep}
          onStepChange={onWalkthroughStepChange}
          onScenarioSelect={onScenarioSelect}
          scenarios={WALKTHROUGH_SCENARIOS}
          services={{
            walletHost: walletReady,
            nodeProxy: remoteReady,
            platformService: platformServiceReady,
          }}
        />

        <div className="host-controls">
          <span className="host-controls__label">Transport</span>
          <div className="host-segment host-segment--dual" role="group" aria-label="Transport">
            <button
              type="button"
              className={[
                'host-segment__btn',
                transport === 'local' ? 'host-segment__btn--active' : '',
                preset === 'microsoft' ? 'host-segment__btn--disabled' : '',
                preset === 'wallet' ? 'host-segment__btn--disabled' : '',
                preset === 'platform' ? 'host-segment__btn--disabled' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              disabled={preset === 'microsoft' || preset === 'wallet' || preset === 'platform'}
              aria-pressed={transport === 'local'}
              onClick={() => onTransportChange('local')}
            >
              Local
            </button>
            <button
              type="button"
              className={[
                'host-segment__btn',
                transport === 'remote' ? 'host-segment__btn--active' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              aria-pressed={transport === 'remote'}
              onClick={() => onTransportChange('remote')}
            >
              Remote
            </button>
          </div>
          <p className="host-controls__hint">
            {preset === 'wallet'
              ? walletReady
                ? `Wallet host OK (mock AI: ${walletHealth?.demoMockAi ? 'on' : 'off'})`
                : 'Run npm run demo — wallet host on :3456'
              : preset === 'platform'
                ? platformServiceReady
                  ? 'Platform SaaS OK — tenant embed active'
                  : 'Run npm run demo:platform — API on :3460'
              : transport === 'remote'
                ? remoteReady
                  ? `Node proxy OK at ${remoteBaseUrl}`
                  : `Start node-proxy or npm run demo -- --with-proxy`
                : 'Encrypted storage in this browser tab.'}
          </p>
        </div>

        <div className="host-controls">
          <span className="host-controls__label">Providers</span>
          <div className="host-segment host-segment--quad" role="group" aria-label="Provider preset">
            {(
              [
                { id: 'api' as const, label: 'API keys' },
                { id: 'wallet' as const, label: 'Wallet' },
                { id: 'platform' as const, label: 'SaaS' },
                { id: 'microsoft' as const, label: 'M365 Copilot' },
                { id: 'all' as const, label: 'All' },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                className={[
                  'host-segment__btn',
                  preset === item.id ? 'host-segment__btn--active' : '',
                  item.id === 'microsoft' && !microsoftReady ? 'host-segment__btn--warn' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                aria-pressed={preset === item.id}
                onClick={() => onPresetChange(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="host-controls">
          <span className="host-controls__label">Embed mode</span>
          <div className="host-segment" role="tablist" aria-label="Embed mode">
            {DEMO_MODES.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={mode === item.id}
                className={[
                  'host-segment__btn',
                  mode === item.id ? 'host-segment__btn--active' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => onModeChange(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          {activeMode ? <p className="host-controls__hint">{activeMode.hint}</p> : null}
        </div>

        <div className="host-controls">
          <span className="host-controls__label">Theme</span>
          <div className="host-segment host-segment--triple" role="group" aria-label="Color theme">
            {(['auto', 'dark', 'light'] as const).map((value) => (
              <button
                key={value}
                type="button"
                className={[
                  'host-segment__btn',
                  theme === value ? 'host-segment__btn--active' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                aria-pressed={theme === value}
                onClick={() => onThemeChange(value)}
              >
                {value === 'auto' ? 'Auto' : value === 'dark' ? 'Dark' : 'Light'}
              </button>
            ))}
          </div>
        </div>

        <p className="host-footnote">
          Full guide: <code className="host-code">docs/walkthrough-demo.md</code>. Web Components:{' '}
          <code className="host-code">examples/vanilla-demo</code>.
        </p>
      </aside>

      <main className="host-main">
        <header className="host-header">
          <h1>{scenario.title}</h1>
          <p>{scenario.subtitle}</p>
        </header>
        <div className={['host-plugin-wrap', scenarioBlocked ? 'host-plugin-wrap--blocked' : ''].filter(Boolean).join(' ')}>
          {scenarioBlocked ? (
            <div className="host-plugin-overlay" role="status">
              <p>Start required services to use this scenario.</p>
              <p className="host-plugin-overlay__hint">See the warning in the walkthrough panel.</p>
            </div>
          ) : null}
          <div className="host-plugin" aria-hidden={scenarioBlocked}>{children}</div>
        </div>
      </main>
    </div>
  );
}
