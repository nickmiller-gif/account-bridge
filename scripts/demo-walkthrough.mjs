#!/usr/bin/env node
/**
 * Interactive Account Bridge walkthrough — starts demo services and prints URLs.
 *
 * Usage (from account-bridge root, after npm run build):
 *   npm run demo
 *   npm run demo -- --with-proxy   # also start node-proxy on 3920
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { assertDemoBuild, DEMO_PORTS, DEMO_URLS, waitForHttpOk } from './demo-shared.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const withProxy = process.argv.includes('--with-proxy');
const withPlatform = process.argv.includes('--with-platform');

const children = [];
let shuttingDown = false;

function run(name, cwd, cmd, args, env = {}) {
  const child = spawn(cmd, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  });
  child.stdout.on('data', (chunk) => {
    process.stdout.write(`[${name}] ${chunk}`);
  });
  child.stderr.on('data', (chunk) => {
    process.stderr.write(`[${name}] ${chunk}`);
  });
  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    console.error(`[demo] ${name} exited (code=${code ?? 'null'}, signal=${signal ?? 'null'})`);
    shutdown(1);
  });
  children.push(child);
  return child;
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    child.kill('SIGTERM');
  }
  setTimeout(() => process.exit(code), 300);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

try {
  await assertDemoBuild();
} catch (err) {
  console.error(`[demo] ${err instanceof Error ? err.message : err}`);
  process.exit(1);
}

console.log('');
console.log('  Account Bridge — interactive walkthrough');
console.log('  ========================================');
console.log('');
console.log('  Starting services…');
console.log('');

run('wallet-host', path.join(root, 'examples/wallet-host'), 'node', ['server.mjs'], {
  DEMO_MOCK_AI: '1',
  PORT: String(DEMO_PORTS.wallet),
  HOST: '127.0.0.1',
});

if (withProxy) {
  run('node-proxy', path.join(root, 'examples/node-proxy'), 'npm', ['run', 'dev'], {
    PORT: String(DEMO_PORTS.proxy),
    HOST: '127.0.0.1',
  });
} else {
  console.log('[demo] Skipping node-proxy (pass --with-proxy for scenario 3)');
}

if (withPlatform) {
  run('platform-service', path.join(root, 'examples/platform-service'), 'node', ['server.mjs'], {
    PORT: String(DEMO_PORTS.platform),
    HOST: '127.0.0.1',
    PLATFORM_SEED_DEMO: '1',
    DEMO_MOCK_AI: '1',
    DEMO_CORS_ORIGINS: `http://127.0.0.1:${DEMO_PORTS.vite},http://localhost:${DEMO_PORTS.vite},http://127.0.0.1:5176,http://localhost:5176`,
  });
} else {
  console.log('[demo] Skipping platform-service (pass --with-platform for scenario 5)');
}

run('vite-demo', path.join(root, 'examples/vite-demo'), 'npm', ['run', 'dev']);

try {
  await waitForHttpOk(`${DEMO_URLS.wallet}/health`);
  if (withProxy) {
    await waitForHttpOk(`${DEMO_URLS.proxy}/health`);
  }
  if (withPlatform) {
    await waitForHttpOk(`${DEMO_URLS.platform}/health`);
  }
  await waitForHttpOk(DEMO_URLS.vite);
} catch (err) {
  console.error(`[demo] ${err instanceof Error ? err.message : err}`);
  shutdown(1);
}

console.log('');
console.log('  Open the demo');
console.log('  -------------');
console.log(`  UI:          ${DEMO_URLS.vite}`);
console.log(`  Wallet host: ${DEMO_URLS.wallet}  (Bearer demo)`);
if (withProxy) {
  console.log(`  Node proxy:  ${DEMO_URLS.proxy}`);
}
if (withPlatform) {
  console.log(`  Platform:    ${DEMO_URLS.platform}  (scenario 5 · SaaS tenant)`);
}
console.log('');
console.log('  Scenarios (pick in the sidebar walkthrough panel):');
console.log('    1 · BYOK local      — paste API key, no server');
console.log('    2 · Wallet credits  — chat on seeded balance (mock AI)');
console.log('    3 · Remote host     — needs node-proxy (--with-proxy)');
console.log('    4 · Feature gate    — unlock children after connect');
console.log('    5 · Cloud SaaS      — needs platform (--with-platform)');
console.log('');
console.log('  Docs: docs/walkthrough-demo.md');
console.log('  Press Ctrl+C to stop all services.');
console.log('');
