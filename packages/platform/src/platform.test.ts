import { describe, expect, it } from 'vitest';

import { memoryPlatformStore } from './memoryPlatformStore.js';
import { getPlan } from './plans.js';

describe('memoryPlatformStore', () => {
  it('creates host and app with API keys', async () => {
    const store = memoryPlatformStore();
    const { host, hostToken } = await store.createHost({
      email: 'dev@example.com',
      name: 'Dev Co',
    });
    expect(hostToken.startsWith('ab_host_')).toBe(true);

    const resolved = await store.findHostByToken(hostToken);
    expect(resolved?.id).toBe(host.id);

    const { app, secretKey } = await store.createApp({
      hostId: host.id,
      slug: 'My-App',
      displayName: 'My App',
    });
    expect(app.slug).toBe('my-app');
    expect(secretKey.startsWith('ab_sk_')).toBe(true);
    expect(app.publishableKey.startsWith('ab_pk_')).toBe(true);

    expect(await store.findAppBySecretKey(secretKey)).toMatchObject({ id: app.id });
    expect(await store.findAppByPublishableKey(app.publishableKey)).toMatchObject({ id: app.id });
  });

  it('enforces plan app limits', async () => {
    const store = memoryPlatformStore();
    const { host } = await store.createHost({ email: 'a@b.com', name: 'A' });
    await store.createApp({ hostId: host.id, slug: 'one', displayName: 'One' });
    await expect(
      store.createApp({ hostId: host.id, slug: 'two', displayName: 'Two' }),
    ).rejects.toThrow(/Plan limit/);
    expect(getPlan('free').maxApps).toBe(1);
  });
});
