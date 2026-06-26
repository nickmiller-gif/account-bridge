import { access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const DEMO_PORTS = {
  vite: Number(process.env.DEMO_VITE_PORT ?? 5175),
  wallet: Number(process.env.DEMO_WALLET_PORT ?? 3456),
  proxy: Number(process.env.DEMO_PROXY_PORT ?? 3920),
  platform: Number(process.env.DEMO_PLATFORM_PORT ?? 3460),
};

export const DEMO_URLS = {
  vite: `http://127.0.0.1:${DEMO_PORTS.vite}`,
  wallet: `http://127.0.0.1:${DEMO_PORTS.wallet}`,
  proxy: `http://127.0.0.1:${DEMO_PORTS.proxy}`,
  platform: `http://127.0.0.1:${DEMO_PORTS.platform}`,
};

export async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/** Ensure workspace packages are built before starting demo servers. */
export async function assertDemoBuild() {
  const markers = [
    path.join(root, 'packages/server/dist/index.js'),
    path.join(root, 'packages/react/dist/index.js'),
  ];
  for (const marker of markers) {
    if (!(await fileExists(marker))) {
      throw new Error(
        `Demo build missing (${path.relative(root, marker)}). Run: npm run build`,
      );
    }
  }
}

export async function waitForHttpOk(url, { timeoutMs = 60_000, intervalMs = 400 } = {}) {
  const deadline = Date.now() + timeoutMs;
  let lastError = 'unreachable';
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (res.ok) return;
      lastError = `HTTP ${res.status}`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Timed out waiting for ${url} (${lastError})`);
}
