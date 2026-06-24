#!/usr/bin/env node
/**
 * Smoke: examples/platform-service — signup, create app, tenant status with publishable key.
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
    PLATFORM_SEED_DEMO: '0',
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

  console.log('smoke:platform OK');
  shutdown(0);
} catch (err) {
  console.error('smoke:platform FAIL —', err instanceof Error ? err.message : err);
  shutdown(1);
}
