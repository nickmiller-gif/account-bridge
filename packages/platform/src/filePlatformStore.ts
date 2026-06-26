import fs from 'node:fs';
import path from 'node:path';

import {
  memoryPlatformStore,
  type PlatformStoreSnapshot,
} from './memoryPlatformStore.js';
import type { PlatformStore } from './types.js';

function readSnapshot(filePath: string): PlatformStoreSnapshot | null {
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, 'utf8');
  if (!raw.trim()) return null;
  return JSON.parse(raw) as PlatformStoreSnapshot;
}

function writeSnapshotAtomic(filePath: string, snapshot: PlatformStoreSnapshot): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(snapshot, null, 2)}\n`, { mode: 0o600 });
  fs.renameSync(tmp, filePath);
  try {
    fs.chmodSync(filePath, 0o600);
  } catch {
    // best-effort on platforms that restrict chmod
  }
}

/** File-backed platform store — persists hosts/apps as JSON (demo / single-node deploy). */
export function filePlatformStore(filePath: string): PlatformStore {
  const absolute = path.resolve(filePath);
  const inner = memoryPlatformStore();
  const existing = readSnapshot(absolute);
  if (existing) {
    inner.importSnapshot(existing);
  }

  function persist(): void {
    writeSnapshotAtomic(absolute, inner.exportSnapshot());
  }

  return {
    async createHost(params) {
      const result = await inner.createHost(params);
      persist();
      return result;
    },
    findHostByToken: (token) => inner.findHostByToken(token),
    findHostById: (id) => inner.findHostById(id),
    async updateHostPlan(hostId, patch) {
      const host = await inner.updateHostPlan(hostId, patch);
      persist();
      return host;
    },
    async createApp(params) {
      const result = await inner.createApp(params);
      persist();
      return result;
    },
    async updateApp(params) {
      const app = await inner.updateApp(params);
      persist();
      return app;
    },
    async rotateAppSecret(hostId, slug) {
      const result = await inner.rotateAppSecret(hostId, slug);
      persist();
      return result;
    },
    listAppsForHost: (hostId) => inner.listAppsForHost(hostId),
    findAppBySlug: (slug) => inner.findAppBySlug(slug),
    findAppByPublishableKey: (key) => inner.findAppByPublishableKey(key),
    findAppBySecretKey: (key) => inner.findAppBySecretKey(key),
    async incrementAppUsage(appId) {
      await inner.incrementAppUsage(appId);
      persist();
    },
    listAllApps: () => inner.listAllApps(),
  };
}
