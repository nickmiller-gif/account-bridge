#!/usr/bin/env node
/**
 * Smoke: examples/platform-service — demo tenant wallet chat, signup, create app, tenant status.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { waitForHttpOk } from './demo-shared.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const serviceDir = path.join(root, 'examples/platform-service');

let baseUrl = '';
const child = spawn('node', ['server.mjs'], {
  cwd: serviceDir,
  env: {
    ...process.env,
    PORT: '0',
    HOST: '127.0.0.1',
    PLATFORM_SEED_DEMO: '1',
    DEMO_MOCK_AI: '1',
  },
  stdio: ['ignore', 'pipe', 'inherit'],
});

child.stdout.on('data', (chunk) => {
  const text = chunk.toString();
  const match = text.match(/PLATFORM_SERVICE_URL=(\S+)/);
  if (match) baseUrl = match[1];
});

const shutdown = (code) => {
  child.kill('SIGTERM');
  setTimeout(() => child.kill('SIGKILL'), 500);
  process.exit(code);
};

child.on('exit', (exitCode) => {
  if (exitCode !== 0 && exitCode !== null) {
    console.error(`smoke:platform FAIL — server exited ${exitCode}`);
    process.exit(1);
  }
});

try {
  const deadline = Date.now() + 20_000;
  while (!baseUrl && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!baseUrl) {
    throw new Error('Timed out waiting for PLATFORM_SERVICE_URL from stdout');
  }

  await waitForHttpOk(`${baseUrl}/platform/v1/health`, { timeoutMs: 15_000 });

  const demoRes = await fetch(`${baseUrl}/platform/v1/demo-tenant`);
  if (!demoRes.ok) {
    console.error('smoke:platform FAIL — demo-tenant', demoRes.status, await demoRes.text());
    shutdown(1);
  }
  const demo = await demoRes.json();
  if (!demo.publishableKey?.startsWith('ab_pk_') || !demo.tenantBaseUrl) {
    console.error('smoke:platform FAIL — demo tenant payload', demo);
    shutdown(1);
  }

  const tenantHealth = await fetch(`${demo.tenantBaseUrl}/health`, {
    headers: { 'X-Account-Bridge-Publishable-Key': demo.publishableKey },
  });
  if (!tenantHealth.ok) {
    console.error('smoke:platform FAIL — tenant health', tenantHealth.status);
    shutdown(1);
  }

  const tenantHeaders = {
    Authorization: `Bearer ${demo.demoConsumer ?? 'demo-consumer'}`,
    'X-Account-Bridge-Publishable-Key': demo.publishableKey,
  };

  const demoStatusRes = await fetch(`${demo.tenantBaseUrl}/account-bridge/status`, {
    headers: tenantHeaders,
  });
  if (!demoStatusRes.ok) {
    console.error('smoke:platform FAIL — demo tenant status', demoStatusRes.status, await demoStatusRes.text());
    shutdown(1);
  }
  const demoStatus = await demoStatusRes.json();
  if (!demoStatus.ready || !demoStatus.walletEnabled) {
    console.error('smoke:platform FAIL — demo funding not ready', demoStatus);
    shutdown(1);
  }

  const chatRes = await fetch(`${demo.tenantBaseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: { ...tenantHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'platform smoke' }],
    }),
  });
  if (!chatRes.ok) {
    console.error('smoke:platform FAIL — demo tenant chat', chatRes.status, await chatRes.text());
    shutdown(1);
  }
  const chat = await chatRes.json();
  const content = chat.choices?.[0]?.message?.content ?? '';
  if (!String(content).startsWith('Demo wallet reply:')) {
    console.error('smoke:platform FAIL — unexpected chat reply', content);
    shutdown(1);
  }

  const signupRes = await fetch(`${baseUrl}/platform/v1/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `smoke-${Date.now()}@example.com`, name: 'Smoke Host' }),
  });
  if (!signupRes.ok) {
    console.error('smoke:platform FAIL — signup', signupRes.status, await signupRes.text());
    shutdown(1);
  }
  const signup = await signupRes.json();
  const hostToken = signup.hostToken;
  if (!hostToken?.startsWith('ab_host_')) {
    console.error('smoke:platform FAIL — missing hostToken', signup);
    shutdown(1);
  }

  const appRes = await fetch(`${baseUrl}/platform/v1/apps`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${hostToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ slug: `smoke-${Date.now()}`, displayName: 'Smoke App' }),
  });
  if (!appRes.ok) {
    console.error('smoke:platform FAIL — create app', appRes.status, await appRes.text());
    shutdown(1);
  }
  const created = await appRes.json();
  const publishableKey = created.app?.publishableKey;
  const tenantBase = created.app?.tenantBaseUrl;
  if (!publishableKey?.startsWith('ab_pk_') || !tenantBase) {
    console.error('smoke:platform FAIL — app response', created);
    shutdown(1);
  }

  const statusRes = await fetch(`${tenantBase}/account-bridge/status`, {
    headers: {
      Authorization: 'Bearer smoke-consumer',
      'X-Account-Bridge-Publishable-Key': publishableKey,
    },
  });
  if (!statusRes.ok) {
    console.error('smoke:platform FAIL — tenant status', statusRes.status, await statusRes.text());
    shutdown(1);
  }
  const status = await statusRes.json();
  if (typeof status.ready !== 'boolean') {
    console.error('smoke:platform FAIL — unexpected status', status);
    shutdown(1);
  }

  const meRes = await fetch(`${baseUrl}/platform/v1/me`, {
    headers: { Authorization: `Bearer ${hostToken}` },
  });
  if (!meRes.ok) {
    console.error('smoke:platform FAIL — me', meRes.status);
    shutdown(1);
  }
  const me = await meRes.json();
  if (!me.usage?.monthlyRequestLimit || !Array.isArray(me.apps)) {
    console.error('smoke:platform FAIL — me usage payload', me);
    shutdown(1);
  }

  const patchRes = await fetch(`${baseUrl}/platform/v1/apps/${created.app.slug}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${hostToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ displayName: 'Smoke App Updated' }),
  });
  if (!patchRes.ok) {
    console.error('smoke:platform FAIL — patch app', patchRes.status, await patchRes.text());
    shutdown(1);
  }
  const patched = await patchRes.json();
  if (patched.app?.displayName !== 'Smoke App Updated') {
    console.error('smoke:platform FAIL — patch response', patched);
    shutdown(1);
  }

  const badTenantRes = await fetch(`${tenantBase}/account-bridge/status`, {
    headers: { Authorization: 'Bearer smoke-consumer' },
  });
  if (badTenantRes.status !== 401) {
    console.error('smoke:platform FAIL — expected 401 without publishable key', badTenantRes.status);
    shutdown(1);
  }

  const reservedRes = await fetch(`${baseUrl}/platform/v1/apps`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${hostToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ slug: 'platform', displayName: 'Bad' }),
  });
  if (reservedRes.status !== 400) {
    console.error('smoke:platform FAIL — reserved slug should 400', reservedRes.status);
    shutdown(1);
  }

  console.log('smoke:platform OK');
  shutdown(0);
} catch (err) {
  console.error('smoke:platform FAIL —', err instanceof Error ? err.message : err);
  shutdown(1);
}
