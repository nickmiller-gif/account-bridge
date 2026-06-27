import { useCallback, useEffect, useMemo, useState } from 'react';

const API_BASE = import.meta.env.VITE_PLATFORM_API_URL ?? 'http://127.0.0.1:3460';
const HOST_TOKEN_KEY = 'ab-platform-host-token';
const WALKTHROUGH_URL = 'http://127.0.0.1:5175';

interface Plan {
  id: string;
  name: string;
  priceCents: number;
  maxApps: number;
  maxMonthlyRequests: number;
  walletEnabled?: boolean;
}

interface AppUsage {
  monthlyRequestCount: number;
  monthlyRequestLimit: number;
  usagePercent: number;
  requestsRemaining: number;
}

interface PlatformApp {
  id: string;
  slug: string;
  displayName: string;
  publishableKey: string;
  tenantBaseUrl: string;
  fundingPolicy: { mode: string; wallet?: { enabled?: boolean } };
  usage: AppUsage;
}

interface DemoTenant {
  slug: string;
  publishableKey: string;
  tenantBaseUrl: string;
  demoConsumer: string;
}

interface MeResponse {
  host: { email: string; name: string; planId: string; planStatus: string };
  plan: Plan;
  usage: AppUsage;
  apps: PlatformApp[];
}

type FundingMode = 'byok' | 'auto' | 'wallet';

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, init);
  } catch {
    throw new Error(
      `Cannot reach platform API at ${API_BASE}. Start it with: npm run demo:platform (from account-bridge root).`,
    );
  }
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
  return data;
}

async function copyText(value: string): Promise<void> {
  await navigator.clipboard.writeText(value);
}

function UsageBar({ usage, label }: { usage: AppUsage; label?: string }) {
  return (
    <div className="usage">
      {label ? <span className="usage__label">{label}</span> : null}
      <div className="usage__track" role="progressbar" aria-valuenow={usage.usagePercent} aria-valuemin={0} aria-valuemax={100}>
        <div className="usage__fill" style={{ width: `${usage.usagePercent}%` }} />
      </div>
      <span className="usage__meta">
        {usage.monthlyRequestCount.toLocaleString()} / {usage.monthlyRequestLimit.toLocaleString()} req ·{' '}
        {usage.requestsRemaining.toLocaleString()} left
      </span>
    </div>
  );
}

function fundingPolicyForMode(mode: FundingMode) {
  if (mode === 'wallet') return { mode: 'wallet' as const, wallet: { enabled: true } };
  if (mode === 'auto') return { mode: 'auto' as const, wallet: { enabled: true } };
  return { mode: 'byok' as const };
}

function fundingModeLabel(app: PlatformApp): string {
  const mode = app.fundingPolicy.mode;
  if (mode === 'auto') return 'Auto (BYOK or credits)';
  if (mode === 'wallet') return 'Credits only';
  return 'BYOK only';
}

export function App() {
  const [hostToken, setHostToken] = useState(() => localStorage.getItem(HOST_TOKEN_KEY) ?? '');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [me, setMe] = useState<MeResponse | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [demoTenant, setDemoTenant] = useState<DemoTenant | null>(null);
  const [newSlug, setNewSlug] = useState('');
  const [newAppName, setNewAppName] = useState('');
  const [newFundingMode, setNewFundingMode] = useState<FundingMode>('byok');
  const [lastSecret, setLastSecret] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const authHeaders = useMemo(
    () => ({
      Authorization: `Bearer ${hostToken}`,
      'Content-Type': 'application/json',
    }),
    [hostToken],
  );

  const refreshMe = useCallback(async () => {
    if (!hostToken) {
      setMe(null);
      return;
    }
    const data = await api<MeResponse>('/platform/v1/me', { headers: authHeaders });
    setMe(data);
  }, [authHeaders, hostToken]);

  useEffect(() => {
    void api<{ plans: Plan[] }>('/platform/v1/plans')
      .then((data) => setPlans(data.plans))
      .catch(() => setPlans([]));
    void api<DemoTenant>('/platform/v1/demo-tenant')
      .then(setDemoTenant)
      .catch(() => setDemoTenant(null));
  }, []);

  useEffect(() => {
    void refreshMe().catch((err: Error) => {
      setError(err.message);
      setMe(null);
    });
  }, [refreshMe]);

  const walletPlansAllowed = me?.plan.walletEnabled ?? false;

  async function onSignup() {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const data = await api<{ hostToken: string }>('/platform/v1/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name }),
      });
      setHostToken(data.hostToken);
      localStorage.setItem(HOST_TOKEN_KEY, data.hostToken);
      setMessage('Account created — host token saved in this browser.');
      await refreshMe();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed');
    } finally {
      setLoading(false);
    }
  }

  async function onCreateApp() {
    setLoading(true);
    setError(null);
    setMessage(null);
    setLastSecret(null);
    try {
      const fundingPolicy =
        newFundingMode === 'byok' ? fundingPolicyForMode('byok') : fundingPolicyForMode(newFundingMode);
      const data = await api<{ app: PlatformApp; secretKey: string }>('/platform/v1/apps', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          slug: newSlug,
          displayName: newAppName || newSlug,
          fundingPolicy,
        }),
      });
      setLastSecret(data.secretKey);
      setMessage('App created — copy the secret key now (shown once).');
      setNewSlug('');
      setNewAppName('');
      await refreshMe();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create app failed');
    } finally {
      setLoading(false);
    }
  }

  async function onUpdateFunding(app: PlatformApp, mode: FundingMode) {
    setLoading(true);
    setError(null);
    try {
      await api(`/platform/v1/apps/${app.slug}`, {
        method: 'PATCH',
        headers: authHeaders,
        body: JSON.stringify({ fundingPolicy: fundingPolicyForMode(mode) }),
      });
      setMessage(`Updated ${app.slug} funding to ${mode}.`);
      await refreshMe();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setLoading(false);
    }
  }

  async function onRotateSecret(app: PlatformApp) {
    setLoading(true);
    setError(null);
    setLastSecret(null);
    try {
      const data = await api<{ secretKey: string }>(`/platform/v1/apps/${app.slug}/rotate-secret`, {
        method: 'POST',
        headers: authHeaders,
      });
      setLastSecret(data.secretKey);
      setMessage(`Rotated secret for ${app.slug} — copy the new key now.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rotate failed');
    } finally {
      setLoading(false);
    }
  }

  async function onCheckout(planId: string) {
    setLoading(true);
    setError(null);
    try {
      const data = await api<{ url: string }>('/platform/v1/billing/checkout', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ planId }),
      });
      window.open(data.url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Checkout unavailable (Stripe optional in demo)');
    } finally {
      setLoading(false);
    }
  }

  function embedSnippet(app: PlatformApp): string {
    return `<AccountBridgeEmbed
  transport="remote"
  appId="${app.slug}"
  baseUrl="${app.tenantBaseUrl}"
  publishableKey="${app.publishableKey}"
  getAuthHeaders={() => ({ Authorization: 'Bearer YOUR_USER_SESSION' })}
  mode="full"
/>`;
  }

  return (
    <div className="shell">
      <header className="hero">
        <h1>Account Bridge Host Console</h1>
        <p>Sign up, create tenant apps, copy embed keys, upgrade plans — sell BYOK + wallet AI to your users.</p>
        <p className="mono" style={{ marginTop: '0.75rem' }}>
          API: {API_BASE}
        </p>
      </header>

      {demoTenant ? (
        <section className="card banner">
          <h2>Demo tenant (walkthrough)</h2>
          <p>
            Seeded app <code>{demoTenant.slug}</code> — open{' '}
            <a href={WALKTHROUGH_URL} target="_blank" rel="noreferrer">
              vite walkthrough
            </a>{' '}
            scenario 5 or run <code>npm run demo -- --with-platform</code>.
          </p>
          <label>Tenant URL</label>
          <div className="mono">{demoTenant.tenantBaseUrl}</div>
        </section>
      ) : null}

      {error ? <p className="error">{error}</p> : null}
      {message ? <p className="success">{message}</p> : null}

      <div className="grid">
        {!hostToken ? (
          <section className="card">
            <h2>Create host account</h2>
            <label htmlFor="email">Work email</label>
            <input id="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
            <label htmlFor="name">Company name</label>
            <input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Inc" />
            <button type="button" disabled={loading || !email.trim()} onClick={() => void onSignup()}>
              Sign up (Free)
            </button>
          </section>
        ) : (
          <section className="card">
            <h2>Your account</h2>
            {me ? (
              <>
                <p>
                  <strong>{me.host.name}</strong> · {me.host.email}
                </p>
                <p>
                  Plan: <strong>{me.plan.name}</strong> ({me.host.planStatus}) · {me.apps.length}/{me.plan.maxApps}{' '}
                  apps
                </p>
                <UsageBar usage={me.usage} label="Account request budget (all apps)" />
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    localStorage.removeItem(HOST_TOKEN_KEY);
                    setHostToken('');
                    setMe(null);
                  }}
                >
                  Sign out
                </button>
              </>
            ) : (
              <p>Loading…</p>
            )}
          </section>
        )}

        <section className="card">
          <h2>Plans</h2>
          <div className="plans">
            {plans.map((plan) => (
              <div key={plan.id} className="plan">
                <strong>
                  {plan.name} — {plan.priceCents === 0 ? 'Free' : `$${plan.priceCents / 100}/mo`}
                </strong>
                <span>
                  {plan.maxApps} app(s) · {plan.maxMonthlyRequests.toLocaleString()} req/mo
                  {plan.walletEnabled ? ' · wallet' : ''}
                </span>
                {hostToken && plan.id !== 'free' ? (
                  <button type="button" style={{ marginTop: '0.5rem' }} disabled={loading} onClick={() => void onCheckout(plan.id)}>
                    Upgrade
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        {hostToken ? (
          <section className="card">
            <h2>New app</h2>
            <label htmlFor="slug">Slug (URL segment)</label>
            <input id="slug" value={newSlug} onChange={(e) => setNewSlug(e.target.value)} placeholder="my-product" />
            <label htmlFor="display">Display name</label>
            <input
              id="display"
              value={newAppName}
              onChange={(e) => setNewAppName(e.target.value)}
              placeholder="My Product"
            />
            <label htmlFor="funding">Consumer funding</label>
            <select
              id="funding"
              value={newFundingMode}
              onChange={(e) => setNewFundingMode(e.target.value as FundingMode)}
            >
              <option value="byok">BYOK only</option>
              <option value="auto" disabled={!walletPlansAllowed}>
                Auto — BYOK or app credits{walletPlansAllowed ? '' : ' (Pro+ required)'}
              </option>
              <option value="wallet" disabled={!walletPlansAllowed}>
                App credits only{walletPlansAllowed ? '' : ' (Pro+ required)'}
              </option>
            </select>
            <button type="button" disabled={loading || !newSlug.trim()} onClick={() => void onCreateApp()}>
              Create app
            </button>
            {lastSecret ? (
              <div className="snippet">
                <label>Secret key (server-side only)</label>
                <div className="mono">{lastSecret}</div>
                <button type="button" className="secondary" onClick={() => void copyText(lastSecret).then(() => setMessage('Secret copied'))}>
                  Copy secret
                </button>
              </div>
            ) : null}
          </section>
        ) : null}

        {me?.apps.length ? (
          <section className="card" style={{ gridColumn: '1 / -1' }}>
            <h2>Your apps</h2>
            {me.apps.map((app) => (
              <div key={app.id} className="app-row">
                <p>
                  <strong>{app.displayName}</strong> · <code>{app.slug}</code> · {fundingModeLabel(app)}
                </p>
                <UsageBar usage={app.usage} label="This app" />
                <label>Publishable key (browser embed)</label>
                <div className="mono">{app.publishableKey}</div>
                <div className="row-actions">
                  <button type="button" className="secondary" onClick={() => void copyText(app.publishableKey).then(() => setMessage('Publishable key copied'))}>
                    Copy key
                  </button>
                  <button type="button" className="secondary" onClick={() => void copyText(embedSnippet(app)).then(() => setMessage('Embed snippet copied'))}>
                    Copy embed
                  </button>
                  <button type="button" className="secondary" disabled={loading} onClick={() => void onRotateSecret(app)}>
                    Rotate secret
                  </button>
                </div>
                <label>Tenant base URL</label>
                <div className="mono">{app.tenantBaseUrl}</div>
                {walletPlansAllowed ? (
                  <>
                    <label>Change funding</label>
                    <div className="row-actions">
                      {(['byok', 'auto', 'wallet'] as FundingMode[]).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          className="secondary"
                          disabled={loading || app.fundingPolicy.mode === mode}
                          onClick={() => void onUpdateFunding(app, mode)}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                  </>
                ) : null}
                <label>React embed snippet</label>
                <pre className="mono">{embedSnippet(app)}</pre>
              </div>
            ))}
          </section>
        ) : null}
      </div>
    </div>
  );
}
