import { useCallback, useEffect, useMemo, useState } from 'react';

const API_BASE = import.meta.env.VITE_PLATFORM_API_URL ?? 'http://127.0.0.1:3460';
const HOST_TOKEN_KEY = 'ab-platform-host-token';

interface Plan {
  id: string;
  name: string;
  priceCents: number;
  maxApps: number;
  monthlyRequests: number;
}

interface PlatformApp {
  id: string;
  slug: string;
  displayName: string;
  publishableKey: string;
  tenantBaseUrl: string;
  monthlyRequestCount: number;
}

interface MeResponse {
  host: { email: string; name: string; planId: string; planStatus: string };
  plan: Plan;
  apps: PlatformApp[];
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init);
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? `HTTP ${res.status}`);
  }
  return data;
}

export function App() {
  const [hostToken, setHostToken] = useState(() => localStorage.getItem(HOST_TOKEN_KEY) ?? '');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [me, setMe] = useState<MeResponse | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [newSlug, setNewSlug] = useState('');
  const [newAppName, setNewAppName] = useState('');
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
  }, []);

  useEffect(() => {
    void refreshMe().catch((err: Error) => {
      setError(err.message);
      setMe(null);
    });
  }, [refreshMe]);

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
      const data = await api<{ app: PlatformApp; secretKey: string }>('/platform/v1/apps', {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ slug: newSlug, displayName: newAppName || newSlug }),
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
                  {plan.maxApps} app(s) · {plan.monthlyRequests.toLocaleString()} req/mo
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
            <button type="button" disabled={loading || !newSlug.trim()} onClick={() => void onCreateApp()}>
              Create app
            </button>
            {lastSecret ? (
              <div className="snippet">
                <label>Secret key (server-side only)</label>
                <div className="mono">{lastSecret}</div>
              </div>
            ) : null}
          </section>
        ) : null}

        {me?.apps.length ? (
          <section className="card" style={{ gridColumn: '1 / -1' }}>
            <h2>Your apps</h2>
            {me.apps.map((app) => (
              <div key={app.id} style={{ marginBottom: '1.25rem' }}>
                <p>
                  <strong>{app.displayName}</strong> · <code>{app.slug}</code> · {app.monthlyRequestCount} req this
                  month
                </p>
                <label>Publishable key (browser embed)</label>
                <div className="mono">{app.publishableKey}</div>
                <label>Tenant base URL</label>
                <div className="mono">{app.tenantBaseUrl}</div>
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
