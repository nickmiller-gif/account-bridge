#!/usr/bin/env node
/**
 * Smoke: examples/wallet-host — health, wallet-funded gateway, mock AI reply.
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { waitForHttpOk } from './demo-shared.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hostDir = path.join(root, 'examples/wallet-host');

let baseUrl = '';
const child = spawn('node', ['server.mjs'], {
  cwd: hostDir,
  env: {
    ...process.env,
    PORT: '0',
    HOST: '127.0.0.1',
    DEMO_MOCK_AI: '1',
  },
  stdio: ['ignore', 'pipe', 'inherit'],
});

child.stdout.on('data', (chunk) => {
  const text = chunk.toString();
  const match = text.match(/WALLET_HOST_URL=(\S+)/);
  if (match) baseUrl = match[1];
});

const shutdown = (code) => {
  child.kill('SIGTERM');
  setTimeout(() => child.kill('SIGKILL'), 500);
  process.exit(code);
};

child.on('exit', (exitCode) => {
  if (exitCode !== 0 && exitCode !== null) {
    console.error(`smoke:wallet-host FAIL — server exited ${exitCode}`);
    process.exit(1);
  }
});

try {
  const deadline = Date.now() + 20_000;
  while (!baseUrl && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 100));
  }
  if (!baseUrl) {
    throw new Error('Timed out waiting for WALLET_HOST_URL from wallet-host stdout');
  }

  await waitForHttpOk(`${baseUrl}/health`, { timeoutMs: 15_000 });

  const health = await (await fetch(`${baseUrl}/health`)).json();
  if (!health.ok || health.demoMockAi !== true) {
    console.error('smoke:wallet-host FAIL — health', health);
    shutdown(1);
  }

  const statusRes = await fetch(`${baseUrl}/account-bridge/status`, {
    headers: { Authorization: 'Bearer demo' },
  });
  if (!statusRes.ok) {
    console.error('smoke:wallet-host FAIL — status', statusRes.status);
    shutdown(1);
  }
  const status = await statusRes.json();
  if (!status.ready || !status.walletEnabled) {
    console.error('smoke:wallet-host FAIL — funding not ready', status);
    shutdown(1);
  }

  const chatRes = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer demo',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'smoke' }],
    }),
  });
  if (!chatRes.ok) {
    console.error('smoke:wallet-host FAIL — chat', chatRes.status, await chatRes.text());
    shutdown(1);
  }
  const chat = await chatRes.json();
  const content = chat.choices?.[0]?.message?.content ?? '';
  if (!String(content).startsWith('Demo wallet reply:')) {
    console.error('smoke:wallet-host FAIL — unexpected reply', content);
    shutdown(1);
  }

  console.log('smoke:wallet-host OK');
  shutdown(0);
} catch (err) {
  console.error('smoke:wallet-host FAIL —', err instanceof Error ? err.message : err);
  shutdown(1);
}
