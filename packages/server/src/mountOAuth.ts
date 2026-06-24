import type { Express, Request, Response } from 'express';

import type { AccountBridge } from '@account-bridge/core';
import {
  createOAuthRouteHandlers,
  type GoogleOAuthConfig,
  type MicrosoftOAuthConfig,
  type MountOAuthRoutesOptions,
  type OAuthStateStore,
} from './oauth.js';

export interface MountAccountBridgeOAuthOptions {
  app: Express;
  google?: GoogleOAuthConfig;
  microsoft?: MicrosoftOAuthConfig;
  stateStore: OAuthStateStore;
  resolveUser: MountOAuthRoutesOptions['resolveUser'];
  providerMap?: Record<string, string>;
  createBridge: (userId: string) => AccountBridge;
  successRedirect?: string;
  basePath?: string;
}

export function mountAccountBridgeOAuth(options: MountAccountBridgeOAuthOptions): void {
  const providerMap = options.providerMap ?? { google: 'gemini', microsoft: 'microsoft_copilot' };
  const handlers = createOAuthRouteHandlers({
    basePath: options.basePath,
    google: options.google,
    microsoft: options.microsoft,
    stateStore: options.stateStore,
    resolveUser: options.resolveUser,
    onOAuthSuccess: async ({ userId, providerKey, credential }) => {
      const bridgeProviderId = providerMap[providerKey] ?? providerKey;
      const bridge = options.createBridge(userId);
      await bridge.connect(bridgeProviderId, credential);
    },
  });

  const startPath = `${handlers.basePath}/:provider/start`;
  const callbackPath = `${handlers.basePath}/:provider/callback`;

  options.app.get(startPath, async (req: Request, res: Response) => {
    const userId = await options.resolveUser(req);
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const provider = String(req.params.provider);
    try {
      const { redirectUrl } = await handlers.handleStart(provider, userId);
      res.redirect(redirectUrl);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'OAuth start failed' });
    }
  });

  options.app.get(callbackPath, async (req: Request, res: Response) => {
    try {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(req.query)) {
        if (typeof value === 'string') params.set(key, value);
      }
      await handlers.handleCallback(params);
      if (options.successRedirect) {
        res.redirect(options.successRedirect);
      } else {
        res.json({ ok: true });
      }
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'OAuth callback failed' });
    }
  });
}
