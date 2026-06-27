import { useCallback, useEffect, useMemo, useState } from 'react';

import type { ProviderId } from '@account-bridge/core';
import { AccountBridgeEmbed, type AccountBridgeEmbedMode } from '@account-bridge/react';
import type { AccountBridgeThemeSetting } from '@account-bridge/react';

import { AppShell, type DemoProviderPreset, type DemoTransport } from './AppShell.js';
import {
  scenarioById,
  WALKTHROUGH_SCENARIOS,
  type WalkthroughScenarioId,
} from './walkthrough.js';

const DEMO_APP_ID = 'embed-preview';
const REMOTE_BASE_URL = import.meta.env.VITE_ACCOUNT_BRIDGE_URL ?? 'http://localhost:3920';
const WALLET_HOST_URL = import.meta.env.VITE_WALLET_HOST_URL ?? 'http://localhost:3456';
const PLATFORM_SERVICE_URL = import.meta.env.VITE_PLATFORM_SERVICE_URL ?? 'http://127.0.0.1:3460';

const SCENARIO_STORAGE_KEY = 'ab-walkthrough-scenario';
const STEP_STORAGE_KEY = 'ab-walkthrough-step';

function DemoFeature() {
  return (
    <div className="host-feature">
      <span className="host-feature__icon" aria-hidden>
        ✓
      </span>
      <div>
        <strong>AI feature unlocked</strong>
        <p>This block renders only after funding is ready — connect a provider or use wallet credits.</p>
      </div>
    </div>
  );
}

function DemoPageContent() {
  return (
    <div className="host-page">
      <p className="host-page__lede">
        Sample app content stays visible. Tap the ✦ button to open the assistant without leaving the page.
      </p>
      <div className="host-page__cards">
        <article className="host-page__card">
          <h3>Dashboard</h3>
          <p>Your host app UI lives here — Account Bridge adds settings and AI on top.</p>
        </article>
        <article className="host-page__card">
          <h3>Reports</h3>
          <p>Panel mode keeps the FAB available on every route.</p>
        </article>
      </div>
    </div>
  );
}

interface RemoteHealth {
  ok: boolean;
  microsoftOAuth?: boolean;
}

interface WalletHealth {
  ok: boolean;
  demoMockAi?: boolean;
}

interface PlatformDemoTenant {
  slug: string;
  publishableKey: string;
  tenantBaseUrl: string;
}

function resolveEmbedConfig(
  transport: DemoTransport,
  preset: DemoProviderPreset,
  remoteHealth: RemoteHealth | null,
) {
  const microsoftAvailable = transport === 'remote' && remoteHealth?.microsoftOAuth === true;

  if (preset === 'wallet') {
    return {
      transport: 'remote' as const,
      baseUrl: WALLET_HOST_URL,
      includeMicrosoftCopilot: false,
      includeCompatProviders: false,
      providerIds: ['openai', 'anthropic', 'gemini'] as ProviderId[],
      copilotProviderId: undefined,
      introTitle: 'Fund AI your way',
      introDescription:
        'Connect your own API key or use app credits — wallet scenario uses mock AI on port 3456.',
      fundingPolicy: {
        mode: 'auto' as const,
        wallet: { enabled: true },
      },
    };
  }

  if (preset === 'platform') {
    return {
      transport: 'remote' as const,
      includeMicrosoftCopilot: false,
      includeCompatProviders: false,
      providerIds: ['openai', 'anthropic', 'gemini'] as ProviderId[],
      copilotProviderId: undefined,
      introTitle: 'Hosted Account Bridge',
      introDescription:
        'Multi-tenant SaaS — publishable key + app credits (mock AI when demo platform is running).',
      fundingPolicy: {
        mode: 'auto' as const,
        wallet: { enabled: true },
      },
    };
  }

  if (preset === 'microsoft') {
    return {
      transport: 'remote' as const,
      includeMicrosoftCopilot: true,
      includeCompatProviders: false,
      providerIds: ['microsoft_copilot'] as ProviderId[],
      copilotProviderId: 'microsoft_copilot' as const,
      introTitle: 'Connect Microsoft Copilot',
      introDescription:
        'Sign in with your work account. Usage bills to your M365 Copilot license — not this app.',
    };
  }

  if (preset === 'all' && microsoftAvailable) {
    return {
      includeMicrosoftCopilot: true,
      includeCompatProviders: false,
      providerIds: ['openai', 'anthropic', 'gemini', 'microsoft_copilot'] as ProviderId[],
      copilotProviderId: undefined,
      introTitle: undefined,
      introDescription: undefined,
    };
  }

  return {
    includeMicrosoftCopilot: false,
    includeCompatProviders: false,
    providerIds: ['openai', 'anthropic', 'gemini'] as ProviderId[],
    copilotProviderId: undefined,
    introTitle: undefined,
    introDescription: undefined,
  };
}

function readStoredScenario(): WalkthroughScenarioId {
  const raw = sessionStorage.getItem(SCENARIO_STORAGE_KEY);
  if (raw && WALKTHROUGH_SCENARIOS.some((s) => s.id === raw)) {
    return raw as WalkthroughScenarioId;
  }
  return 'byok-local';
}

function readStoredStep(scenarioId: WalkthroughScenarioId): number {
  const raw = Number(sessionStorage.getItem(STEP_STORAGE_KEY) ?? '0');
  const max = scenarioById(scenarioId).steps.length - 1;
  if (!Number.isFinite(raw)) return 0;
  return Math.min(Math.max(0, raw), max);
}

function pollHealth<T>(
  url: string,
  onOk: (data: T) => void,
  onFail: () => void,
  intervalMs = 4000,
) {
  let cancelled = false;
  const poll = () => {
    void fetch(url)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('unhealthy'))))
      .then((data: T) => {
        if (!cancelled) onOk(data);
      })
      .catch(() => {
        if (!cancelled) onFail();
      });
  };
  poll();
  const timer = setInterval(poll, intervalMs);
  return () => {
    cancelled = true;
    clearInterval(timer);
  };
}

export function App() {
  const initialScenario = readStoredScenario();
  const [scenarioId, setScenarioId] = useState<WalkthroughScenarioId>(initialScenario);
  const [walkthroughStep, setWalkthroughStep] = useState(() => readStoredStep(initialScenario));
  const [mode, setMode] = useState<AccountBridgeEmbedMode>(() => scenarioById(readStoredScenario()).mode);
  const [theme, setTheme] = useState<AccountBridgeThemeSetting>('auto');
  const [transport, setTransport] = useState<DemoTransport>(() => scenarioById(readStoredScenario()).transport);
  const [preset, setPreset] = useState<DemoProviderPreset>(() => scenarioById(readStoredScenario()).preset);
  const [remoteHealth, setRemoteHealth] = useState<RemoteHealth | null>(null);
  const [walletHealth, setWalletHealth] = useState<WalletHealth | null>(null);
  const [platformHealth, setPlatformHealth] = useState<{ ok: boolean } | null>(null);
  const [platformTenant, setPlatformTenant] = useState<PlatformDemoTenant | null>(null);

  const scenario = useMemo(() => scenarioById(scenarioId), [scenarioId]);

  const sessionPass = useMemo(() => {
    const key = 'ab-demo-pass';
    let pass = sessionStorage.getItem(key);
    if (!pass) {
      pass = crypto.randomUUID();
      sessionStorage.setItem(key, pass);
    }
    return pass;
  }, []);

  const demoAuthToken = useMemo(() => {
    const key = 'ab-demo-auth';
    let token = sessionStorage.getItem(key);
    if (!token) {
      token = crypto.randomUUID();
      sessionStorage.setItem(key, token);
    }
    return token;
  }, []);

  const applyScenario = useCallback((id: WalkthroughScenarioId) => {
    const next = scenarioById(id);
    setScenarioId(id);
    setWalkthroughStep(0);
    setMode(next.mode);
    setTransport(next.transport);
    setPreset(next.preset);
    sessionStorage.setItem(SCENARIO_STORAGE_KEY, id);
    sessionStorage.setItem(STEP_STORAGE_KEY, '0');
  }, []);

  const onWalkthroughStepChange = useCallback(
    (step: number) => {
      const clamped = Math.min(Math.max(0, step), scenario.steps.length - 1);
      setWalkthroughStep(clamped);
      sessionStorage.setItem(STEP_STORAGE_KEY, String(clamped));
    },
    [scenario.steps.length],
  );

  useEffect(() => {
    return pollHealth<RemoteHealth>(
      `${REMOTE_BASE_URL}/health`,
      (data) => setRemoteHealth(data),
      () => setRemoteHealth({ ok: false, microsoftOAuth: false }),
    );
  }, []);

  useEffect(() => {
    return pollHealth<WalletHealth>(
      `${WALLET_HOST_URL}/health`,
      (data) => setWalletHealth(data),
      () => setWalletHealth({ ok: false }),
    );
  }, []);

  useEffect(() => {
    return pollHealth<{ ok: boolean }>(
      `${PLATFORM_SERVICE_URL}/health`,
      (data) => setPlatformHealth(data),
      () => setPlatformHealth({ ok: false }),
    );
  }, []);

  useEffect(() => {
    if (platformHealth?.ok !== true) {
      setPlatformTenant(null);
      return;
    }
    let cancelled = false;
    const load = () => {
      void fetch(`${PLATFORM_SERVICE_URL}/platform/v1/demo-tenant`)
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error('no demo tenant'))))
        .then((data: PlatformDemoTenant) => {
          if (!cancelled) setPlatformTenant(data);
        })
        .catch(() => {
          if (!cancelled) setPlatformTenant(null);
        });
    };
    load();
    const timer = setInterval(load, 8000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [platformHealth?.ok]);

  const scenarioBlocked =
    (scenario.requiresWalletHost && walletHealth?.ok !== true) ||
    (scenario.requiresNodeProxy && remoteHealth?.ok !== true) ||
    (scenario.requiresPlatformService &&
      (platformHealth?.ok !== true || platformTenant?.publishableKey == null));

  const effectiveTransport: DemoTransport =
    preset === 'microsoft' || preset === 'wallet' || preset === 'platform' ? 'remote' : transport;

  const embedConfig = resolveEmbedConfig(effectiveTransport, preset, remoteHealth);

  const embedChildren =
    mode === 'gate' ? <DemoFeature /> : mode === 'panel' ? <DemoPageContent /> : undefined;

  return (
    <AppShell
      mode={mode}
      onModeChange={setMode}
      theme={theme}
      onThemeChange={setTheme}
      transport={effectiveTransport}
      onTransportChange={setTransport}
      preset={preset}
      onPresetChange={setPreset}
      remoteHealth={remoteHealth}
      walletHealth={walletHealth}
      remoteBaseUrl={REMOTE_BASE_URL}
      scenario={scenario}
      walkthroughStep={walkthroughStep}
      onWalkthroughStepChange={onWalkthroughStepChange}
      onScenarioSelect={applyScenario}
      scenarioBlocked={scenarioBlocked}
      platformServiceReady={platformHealth?.ok === true && platformTenant != null}
    >
      <AccountBridgeEmbed
        appId={
          preset === 'wallet' ? 'wallet-demo' : preset === 'platform' ? (platformTenant?.slug ?? 'saas-demo') : DEMO_APP_ID
        }
        transport={effectiveTransport}
        baseUrl={
          effectiveTransport === 'remote'
            ? preset === 'wallet'
              ? WALLET_HOST_URL
              : preset === 'platform'
                ? platformTenant?.tenantBaseUrl
                : REMOTE_BASE_URL
            : undefined
        }
        publishableKey={preset === 'platform' ? platformTenant?.publishableKey : undefined}
        fundingPolicy={'fundingPolicy' in embedConfig ? embedConfig.fundingPolicy : undefined}
        getAuthHeaders={
          effectiveTransport === 'remote'
            ? () => ({
                Authorization:
                  preset === 'wallet'
                    ? 'Bearer demo'
                    : preset === 'platform'
                      ? 'Bearer demo-consumer'
                      : `Bearer ${demoAuthToken}`,
              })
            : undefined
        }
        localPassphrase={sessionPass}
        mode={mode}
        preset="headless"
        theme={theme}
        {...embedConfig}
      >
        {embedChildren}
      </AccountBridgeEmbed>
    </AppShell>
  );
}
