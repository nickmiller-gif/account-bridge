/**
 * Integration smoke — mocked provider validation, no live API keys.
 * Run: node --experimental-vm-modules or tsx scripts/smoke-integration.mjs
 */
import {
  createAccountBridge,
  createDefaultProviders,
  deriveKeyFromSecret,
  memoryStorage,
  requireProvider,
  FeatureLockedError,
} from '@account-bridge/core';

const mockFetch = async (url, init) => {
  if (String(url).includes('oauth2.googleapis.com/token')) {
    return {
      ok: true,
      status: 200,
      json: async () => ({ access_token: 'refreshed-google', expires_in: 3600 }),
    };
  }
  if (String(url).includes('login.microsoftonline.com') && String(url).includes('/token')) {
    return {
      ok: true,
      status: 200,
      json: async () => ({ access_token: 'valid-ms-token', expires_in: 3600, refresh_token: 'rt-new' }),
    };
  }

  const auth = init?.headers?.Authorization ?? init?.headers?.['x-api-key'];
  if (!auth && !init?.headers?.['x-api-key']) {
    return { ok: false, status: 401, text: async () => 'unauthorized' };
  }
  if (String(url).includes('/v1/models')) {
    const key = init?.headers?.Authorization?.replace('Bearer ', '') ?? init?.headers?.['x-api-key'];
    if (key === 'sk-valid-test') {
      return { ok: true, status: 200, text: async () => '', json: async () => ({ data: [] }) };
    }
    return { ok: false, status: 401, text: async () => 'invalid' };
  }
  if (String(url).includes('/v1/chat/completions')) {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        model: 'gpt-4o-mini',
        choices: [{ message: { content: 'Smoke test reply' } }],
        usage: { prompt_tokens: 1, completion_tokens: 2 },
      }),
    };
  }
  if (String(url).includes('/v1beta/models')) {
    const key = init?.headers?.Authorization?.replace('Bearer ', '');
    if (key === 'sk-valid-test' || key === 'ya29-valid') {
      return { ok: true, status: 200, text: async () => '', json: async () => ({ models: [] }) };
    }
    return { ok: false, status: 403, text: async () => 'invalid' };
  }
  if (String(url).includes('/v1/messages')) {
    return {
      ok: true,
      status: 200,
      json: async () => ({
        model: 'claude-3-5-haiku-latest',
        content: [{ type: 'text', text: 'Anthropic smoke reply' }],
        usage: { input_tokens: 1, output_tokens: 2 },
      }),
    };
  }
  if (String(url).includes('graph.microsoft.com/beta/copilot/conversations')) {
    const auth = init?.headers?.Authorization ?? '';
    if (auth.includes('valid-ms-token')) {
      if (String(url).includes('/chat')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            id: 'conv-smoke',
            messages: [{ text: 'Microsoft Copilot smoke reply' }],
          }),
        };
      }
      return { ok: true, status: 201, json: async () => ({ id: 'conv-smoke' }) };
    }
    return { ok: false, status: 401, text: async () => 'invalid' };
  }
  return { ok: false, status: 404, text: async () => 'not found' };
};

async function run() {
  const getKey = async () => ({
    key: await deriveKeyFromSecret('smoke-secret', 'integration'),
  });

  const bridge = createAccountBridge({
    storage: memoryStorage(),
    providers: createDefaultProviders({ includeMicrosoftCopilot: true }),
    getEncryptionKey: getKey,
    userId: 'smoke-user',
    fetch: mockFetch,
  });

  // 1. Not connected initially
  assert(!(await bridge.has('openai')), 'openai should not be connected initially');

  // 2. Feature gate throws when locked
  let locked = false;
  try {
    await requireProvider(bridge, 'openai');
  } catch (e) {
    locked = e instanceof FeatureLockedError;
  }
  assert(locked, 'requireProvider should throw FeatureLockedError');

  // 3. Invalid key rejected
  let invalidRejected = false;
  try {
    await bridge.connect('openai', { apiKey: 'sk-bad' });
  } catch {
    invalidRejected = true;
  }
  assert(invalidRejected, 'invalid key should be rejected');

  // 4. Valid key connects
  await bridge.connect('openai', { apiKey: 'sk-valid-test' });
  assert(await bridge.has('openai'), 'openai should be connected after valid connect');

  // 5. Chat completion works
  const client = await bridge.getClient('openai');
  const reply = await client.complete([{ role: 'user', content: 'Hi' }]);
  assert(reply.content === 'Smoke test reply', `unexpected reply: ${reply.content}`);

  // 6. Anthropic connect + chat
  await bridge.connect('anthropic', { apiKey: 'sk-valid-test' });
  const antClient = await bridge.getClient('anthropic');
  const antReply = await antClient.complete([{ role: 'user', content: 'Hi' }]);
  assert(antReply.content === 'Anthropic smoke reply', `unexpected anthropic reply: ${antReply.content}`);

  // 7. Disconnect
  await bridge.disconnect('openai');
  assert(!(await bridge.has('openai')), 'openai should be disconnected');

  // 8. List providers (registry includes OpenAI-compat presets)
  const list = await bridge.listProviders();
  assert(list.length >= 3, `should list at least 3 providers, got ${list.length}`);
  assert(list.some((p) => p.providerId === 'gemini'), 'gemini in registry');
  assert(list.some((p) => p.providerId === 'groq'), 'groq in registry');
  assert(list.some((p) => p.providerId === 'microsoft_copilot'), 'microsoft_copilot in registry');

  // 10. Microsoft Copilot OAuth connect + chat
  await bridge.connect('microsoft_copilot', { kind: 'oauth', accessToken: 'valid-ms-token' });
  const msClient = await bridge.getClient('microsoft_copilot');
  const msReply = await msClient.complete([{ role: 'user', content: 'Summarize this request' }]);
  assert(msReply.content === 'Microsoft Copilot smoke reply', `unexpected ms reply: ${msReply.content}`);

  // 11. resolveClient uses default provider
  await bridge.setDefaultProvider('anthropic');
  const { client: resolved, providerId } = await bridge.resolveClient();
  assert(providerId === 'anthropic', 'resolveClient should use default provider');
  const resolvedReply = await resolved.complete([{ role: 'user', content: 'Hi' }]);
  assert(resolvedReply.content === 'Anthropic smoke reply', 'resolveClient chat works');

  // 12. Subscribe fires on connect
  let subscribed = false;
  const unsub = bridge.subscribe((e) => {
    if (e.type === 'connect' && e.providerId === 'anthropic') subscribed = true;
  });
  await bridge.connect('anthropic', { apiKey: 'sk-valid-test' });
  unsub();
  assert(subscribed, 'subscribe should receive connect event');

  // 13. OAuth refresh before M365 chat
  const refreshBridge = createAccountBridge({
    storage: memoryStorage(),
    providers: createDefaultProviders({ includeMicrosoftCopilot: true }),
    getEncryptionKey: getKey,
    fetch: mockFetch,
    oauthRefresh: {
      microsoft: { clientId: 'cid', clientSecret: 'secret' },
      skewSeconds: 300,
    },
  });
  const expired = new Date(Date.now() - 1000).toISOString();
  await refreshBridge.connect('microsoft_copilot', {
    kind: 'oauth',
    accessToken: 'valid-ms-token',
    refreshToken: 'rt-ms',
    expiresAt: expired,
  });
  const refreshedClient = await refreshBridge.getClient('microsoft_copilot');
  const refreshedReply = await refreshedClient.complete([{ role: 'user', content: 'Hi' }]);
  assert(refreshedReply.content === 'Microsoft Copilot smoke reply', 'oauth refresh + chat works');

  console.log('✓ Integration smoke passed');
}

function assert(condition, message) {
  if (!condition) {
    console.error('✗ FAIL:', message);
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('✗ Smoke failed:', err);
  process.exit(1);
});
