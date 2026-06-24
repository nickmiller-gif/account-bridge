#!/usr/bin/env node
/**
 * Launch platform-service (:3460) + host dashboard (:5176).
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertDemoBuild, waitForHttpOk } from './demo-shared.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const platformPort = Number(process.env.DEMO_PLATFORM_PORT ?? 3460);
const dashboardPort = Number(process.env.DEMO_PLATFORM_DASHBOARD_PORT ?? 5176);

await assertDemoBuild();

const children = [];

function spawnNamed(name, cmd, args, cwd, env = {}) {
  const child = spawn(cmd, args, {
    cwd,
    env: { ...process.env, ...env },
    stdio: 'inherit',
  });
  child.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`[demo:platform] ${name} exited ${code}`);
      shutdown(1);
    }
  });
  children.push(child);
  return child;
}

function shutdown(code = 0) {
  for (const child of children) {
    child.kill('SIGTERM');
  }
  setTimeout(() => {
    for (const child of children) {
      child.kill('SIGKILL');
    }
    process.exit(code);
  }, 400);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

spawnNamed(
  'platform-service',
  'node',
  ['server.mjs'],
  path.join(root, 'examples/platform-service'),
  { PORT: String(platformPort), HOST: '127.0.0.1', PLATFORM_SEED_DEMO: '1' },
);

spawnNamed(
  'platform-dashboard',
  'npx',
  ['vite', '--port', String(dashboardPort), '--host', '127.0.0.1'],
  path.join(root, 'examples/platform-dashboard'),
  {
    VITE_PLATFORM_API_URL: `http://127.0.0.1:${platformPort}`,
  },
);

try {
  await waitForHttpOk(`http://127.0.0.1:${platformPort}/health`, { timeoutMs: 30_000 });
  await waitForHttpOk(`http://127.0.0.1:${dashboardPort}`, { timeoutMs: 60_000 });
  console.log('');
  console.log('Account Bridge Platform demo');
  console.log(`  API + seeded tenant  http://127.0.0.1:${platformPort}`);
  console.log(`  Host dashboard       http://127.0.0.1:${dashboardPort}`);
  console.log('  Walkthrough scenario 5 in vite-demo uses the seeded tenant when platform is running.');
  console.log('');
} catch (err) {
  console.error('[demo:platform]', err instanceof Error ? err.message : err);
  shutdown(1);
}
