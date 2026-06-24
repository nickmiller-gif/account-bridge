import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export default defineConfig({
  root: '.',
  server: { port: 5174 },
  resolve: {
    alias: {
      '@account-bridge/core': path.join(repoRoot, 'packages/core/src/index.ts'),
      '@account-bridge/ui': path.join(repoRoot, 'packages/ui/src/index.ts'),
      '@account-bridge/web': path.join(repoRoot, 'packages/web/src/index.ts'),
    },
  },
});
