import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  createAccountBridge,
  createDefaultProviders,
  deriveKeyFromSecret,
} from '@account-bridge/core';
import { fileEncryptedStorage } from '@account-bridge/core/node';

const mockFetch = async () => ({
  ok: true,
  status: 200,
  text: async () => '',
  json: async () => ({}),
});

const dir = await mkdtemp(join(tmpdir(), 'account-bridge-file-'));
try {
  const getKey = async () => ({
    key: await deriveKeyFromSecret('file-smoke', 'user-1'),
  });

  const storage = fileEncryptedStorage({ namespace: 'smoke', directory: dir });

  const bridge1 = createAccountBridge({
    storage,
    providers: createDefaultProviders(),
    getEncryptionKey: getKey,
    userId: 'user-1',
    fetch: mockFetch,
  });

  await bridge1.connect('openai', { apiKey: 'sk-valid-test' });
  if (!(await bridge1.has('openai'))) throw new Error('expected connected after file write');

  const bridge2 = createAccountBridge({
    storage,
    providers: createDefaultProviders(),
    getEncryptionKey: getKey,
    userId: 'user-1',
    fetch: mockFetch,
  });

  if (!(await bridge2.has('openai'))) throw new Error('expected persisted credentials on reload');

  const client = await bridge2.getClient('openai');
  if (!client?.complete) throw new Error('expected chat client from file-backed store');

  console.log('✓ File storage smoke passed');
} finally {
  await rm(dir, { recursive: true, force: true });
}
