import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/bundle.ts'),
      name: 'AccountBridge',
      formats: ['es', 'iife'],
      fileName: (format) => (format === 'iife' ? 'account-bridge.web.js' : 'account-bridge.web.esm.js'),
    },
    rollupOptions: {
      output: {
        extend: true,
      },
    },
    emptyOutDir: false,
  },
});
