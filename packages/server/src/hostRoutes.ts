import type { Express, Request, Response } from 'express';

import type { AccountBridge, FundingPolicy, HostKeyPool, ProviderId, WalletStore } from '@account-bridge/core';
import {
  assertHostSessionToken,
  assertNoInlineProviderKey,
  ConsumerCreditsRequiredError,
  ConsumerFundingRequiredError,
  resolveFundingSource,
} from '@account-bridge/core';
import { estimatePromptMicrocredits, resolveWalletDebitPricing, debitWalletForStream, estimateStreamPreDebitUsage, logPostStreamDebitFailure, type WalletPricingLoader, type WalletStreamDebitTiming } from '@account-bridge/billing';

import { computeFundingStatus } from './fundingStatus.js';

export interface MountHostRoutesOptions {
  app: Express;
  /** Prefix for consumer settings API (default /account-bridge) */
  apiPrefix?: string;
  resolveUser: (req: Request) => Promise<string | null> | string | null;
  createBridge: (userId: string) => AccountBridge;
  /** Reject provider API keys on connect/chat routes (default true) */
  enforceConsumerCredits?: boolean;
  fundingPolicy?: FundingPolicy;
  resolveFundingPolicy?: () => Promise<FundingPolicy> | FundingPolicy;
  wallet?: WalletStore;
  hostKeyPool?: HostKeyPool;
  appId?: string;
  /** Optional SQL / custom per-app pricing (merged with fundingPolicy.pricing on debit) */
  walletPricingLoader?: WalletPricingLoader;
  /** SSE wallet debit timing — see `@account-bridge/billing` `WalletStreamDebitTiming` */
  walletStreamDebit?: WalletStreamDebitTiming;
}

export function mountAccountBridgeHostRoutes(options: MountHostRoutesOptions): void {
  const prefix = options.apiPrefix ?? '/account-bridge';
  const enforce = options.enforceConsumerCredits !== false;

  async function resolveFundingPolicy(): Promise<FundingPolicy> {
    if (options.resolveFundingPolicy) {
      return options.resolveFundingPolicy();
    }
    return options.fundingPolicy ?? { mode: 'byok' };
  }

  async function userBridge(req: Request): Promise<{ userId: string; bridge: AccountBridge } | null> {
    const authHeader = String(req.headers.authorization ?? '');
    if (enforce && authHeader.startsWith('Bearer ')) {
      try {
        assertHostSessionToken(authHeader.slice('Bearer '.length).trim());
      } catch (err) {
        throw err;
      }
    }
    const userId = await options.resolveUser(req);
    if (!userId) return null;
    return { userId, bridge: options.createBridge(userId) };
  }

  async function userBridgeOrRespond(
    req: Request,
    res: Response,
  ): Promise<{ userId: string; bridge: AccountBridge } | null> {
    try {
      return await userBridge(req);
    } catch (err) {
      if (err instanceof ConsumerCreditsRequiredError) {
        res.status(403).json({ error: err.message });
        return null;
      }
      throw err;
    }
  }

  options.app.post(`${prefix}/connect`, async (req, res) => {
    try {
      const ctx = await userBridge(req);
      if (!ctx) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const { provider, apiKey, defaultModel, kind, accessToken, refreshToken, expiresAt } =
        req.body as {
          provider?: ProviderId;
          apiKey?: string;
          defaultModel?: string;
          kind?: string;
          accessToken?: string;
          refreshToken?: string;
          expiresAt?: string;
        };
      if (!provider) {
        res.status(400).json({ error: 'provider required' });
        return;
      }
      const credential =
        kind === 'oauth' || accessToken
          ? { kind: 'oauth' as const, accessToken: accessToken!, refreshToken, expiresAt, defaultModel }
          : { kind: 'api_key' as const, apiKey: apiKey!, defaultModel };
      if (credential.kind === 'api_key' && !credential.apiKey) {
        res.status(400).json({ error: 'apiKey required for api_key connect' });
        return;
      }
      const result = await ctx.bridge.connect(provider, credential);
      res.json({ ok: true, provider, message: result.message, metadata: result.metadata });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Connection failed' });
    }
  });

  options.app.delete(`${prefix}/connect/:provider`, async (req, res) => {
    const ctx = await userBridgeOrRespond(req, res);
    if (!ctx) {
      if (!res.headersSent) res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    await ctx.bridge.disconnect(String(req.params.provider));
    res.json({ ok: true });
  });

  options.app.get(`${prefix}/providers`, async (req, res) => {
    const ctx = await userBridgeOrRespond(req, res);
    if (!ctx) {
      if (!res.headersSent) res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const providers = await ctx.bridge.listProviders();
    const defaultProvider = await ctx.bridge.getDefaultProvider();
    res.json({ providers, defaultProvider });
  });

  options.app.get(`${prefix}/status`, async (req, res) => {
    const ctx = await userBridgeOrRespond(req, res);
    if (!ctx) {
      if (!res.headersSent) res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const defaultProvider = await ctx.bridge.getDefaultProvider();
    const connected = (await ctx.bridge.listProviders()).filter((p) => p.connected);
    let walletBalance: number | undefined;
    if (options.wallet && options.appId) {
      const bal = await options.wallet.getBalance(ctx.userId, options.appId);
      walletBalance = bal.balanceMicrocredits;
    }
    const fundingPolicy = await resolveFundingPolicy();
    const { ready, walletEnabled } = computeFundingStatus({
      fundingPolicy,
      defaultProvider,
      connectedCount: connected.length,
      walletBalanceMicrocredits: walletBalance,
    });

    res.json({
      ready,
      defaultProvider,
      connectedCount: connected.length,
      fundingPolicy,
      walletBalanceMicrocredits: walletBalance,
      walletEnabled,
    });
  });

  options.app.post(`${prefix}/preferences/default-provider`, async (req, res) => {
    const ctx = await userBridgeOrRespond(req, res);
    if (!ctx) {
      if (!res.headersSent) res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const { providerId } = req.body as { providerId?: ProviderId | null };
    await ctx.bridge.setDefaultProvider(providerId ?? null);
    res.json({ ok: true, defaultProvider: providerId ?? null });
  });

  options.app.post(`${prefix}/validate/:provider`, async (req, res) => {
    const ctx = await userBridge(req);
    if (!ctx) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    try {
      const result = await ctx.bridge.validate(String(req.params.provider));
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Validation failed' });
    }
  });

  async function resolveChatClient(
    ctx: { userId: string; bridge: AccountBridge },
    provider?: ProviderId,
    messageCount = 1,
  ) {
    const appId = options.appId ?? 'default';
    const fundingPolicy = await resolveFundingPolicy();
    const estimate = estimatePromptMicrocredits(messageCount, 200, fundingPolicy?.pricing);
    const funding = await resolveFundingSource({
      bridge: ctx.bridge,
      policy: fundingPolicy,
      wallet: options.wallet,
      hostKeyPool: options.hostKeyPool,
      appId,
      userId: ctx.userId,
      providerId: provider,
      estimatedMicrocredits: estimate,
    });
    return funding;
  }

  async function walletDebitPricing(providerId: ProviderId, model?: string) {
    const appId = options.appId ?? 'default';
    const fundingPolicy = await resolveFundingPolicy();
    return resolveWalletDebitPricing(
      options.walletPricingLoader,
      fundingPolicy?.pricing,
      appId,
      providerId,
      model,
    );
  }

  options.app.post(`${prefix}/chat`, async (req, res) => {
    try {
      if (enforce) assertNoInlineProviderKey(req.body);
      const ctx = await userBridge(req);
      if (!ctx) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const { provider, message, stream } = req.body as {
        provider?: ProviderId;
        message?: string;
        stream?: boolean;
      };
      if (!message) {
        res.status(400).json({ error: 'message required' });
        return;
      }
      const reqIdempotency =
        String(req.headers['x-idempotency-key'] ?? '') || `chat_${Date.now()}`;
      const funding = await resolveChatClient(ctx, provider, 1);
      const { client, providerId, source } = funding;
      if (stream && client.stream) {
        const streamPricing = await walletDebitPricing(providerId);
        if (source === 'wallet' && options.wallet && options.appId) {
          await debitWalletForStream(
            options.walletStreamDebit,
            'before_stream',
            {
              wallet: options.wallet,
              userId: ctx.userId,
              appId: options.appId,
              idempotencyKey: reqIdempotency,
              pricing: streamPricing,
              usage: estimateStreamPreDebitUsage(message.length, providerId),
            },
          );
        }
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.flushHeaders();
        for await (const chunk of client.stream([{ role: 'user', content: message }])) {
          res.write(`data: ${JSON.stringify({ chunk, provider: providerId })}\n\n`);
        }
        if (source === 'wallet' && options.wallet && options.appId) {
          await debitWalletForStream(
            options.walletStreamDebit,
            'after_content',
            {
              wallet: options.wallet,
              userId: ctx.userId,
              appId: options.appId,
              idempotencyKey: reqIdempotency,
              pricing: streamPricing,
              usage: { inputTokens: Math.ceil(message.length / 4), providerId },
            },
            logPostStreamDebitFailure,
          );
        }
        res.write('data: [DONE]\n\n');
        res.end();
        return;
      }
      const result = await client.complete([{ role: 'user', content: message }]);
      if (source === 'wallet' && options.wallet && options.appId) {
        await options.wallet.debit({
          userId: ctx.userId,
          appId: options.appId,
          usage: {
            inputTokens: result.usage?.inputTokens,
            outputTokens: result.usage?.outputTokens,
            providerId,
          },
          idempotencyKey: reqIdempotency,
          pricing: await walletDebitPricing(providerId, result.model),
        });
      }
      res.json({ content: result.content, model: result.model, provider: providerId, funding: source });
    } catch (err) {
      if (err instanceof ConsumerFundingRequiredError) {
        res.status(402).json({ error: err.message, code: 'insufficient_credits' });
        return;
      }
      res.status(403).json({ error: err instanceof Error ? err.message : 'Chat failed' });
    }
  });

  options.app.post(`${prefix}/copilot/chat`, async (req, res) => {
    try {
      if (enforce) assertNoInlineProviderKey(req.body);
      const ctx = await userBridge(req);
      if (!ctx) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      const { provider, messages, stream, systemPrompt } = req.body as {
        provider?: ProviderId;
        messages?: Array<{ role: string; content: string }>;
        stream?: boolean;
        systemPrompt?: string;
      };
      if (!messages?.length) {
        res.status(400).json({ error: 'messages required' });
        return;
      }
      const chatMessages = [
        ...(systemPrompt?.trim()
          ? [{ role: 'system' as const, content: systemPrompt.trim() }]
          : []),
        ...messages
          .filter((m) => m.content?.trim())
          .map((m) => ({
            role: (m.role === 'assistant' ? 'assistant' : m.role === 'system' ? 'system' : 'user') as
              | 'user'
              | 'assistant'
              | 'system',
            content: m.content,
          })),
      ];
      const reqIdempotency =
        String(req.headers['x-idempotency-key'] ?? '') || `copilot_${Date.now()}`;
      const funding = await resolveChatClient(ctx, provider, chatMessages.length);
      const { client, providerId, source } = funding;
      if (stream && client.stream) {
        const chars = chatMessages.reduce((s, m) => s + m.content.length, 0);
        const streamPricing = await walletDebitPricing(providerId);
        if (source === 'wallet' && options.wallet && options.appId) {
          await debitWalletForStream(
            options.walletStreamDebit,
            'before_stream',
            {
              wallet: options.wallet,
              userId: ctx.userId,
              appId: options.appId,
              idempotencyKey: reqIdempotency,
              pricing: streamPricing,
              usage: estimateStreamPreDebitUsage(chars, providerId),
            },
          );
        }
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.flushHeaders();
        for await (const chunk of client.stream(chatMessages)) {
          res.write(`data: ${JSON.stringify({ chunk, provider: providerId })}\n\n`);
        }
        if (source === 'wallet' && options.wallet && options.appId) {
          await debitWalletForStream(
            options.walletStreamDebit,
            'after_content',
            {
              wallet: options.wallet,
              userId: ctx.userId,
              appId: options.appId,
              idempotencyKey: reqIdempotency,
              pricing: streamPricing,
              usage: { inputTokens: Math.ceil(chars / 4), providerId },
            },
            logPostStreamDebitFailure,
          );
        }
        res.write('data: [DONE]\n\n');
        res.end();
        return;
      }
      const result = await client.complete(chatMessages);
      if (source === 'wallet' && options.wallet && options.appId) {
        await options.wallet.debit({
          userId: ctx.userId,
          appId: options.appId,
          usage: {
            inputTokens: result.usage?.inputTokens,
            outputTokens: result.usage?.outputTokens,
            providerId,
          },
          idempotencyKey: reqIdempotency,
          pricing: await walletDebitPricing(providerId, result.model),
        });
      }
      res.json({ content: result.content, model: result.model, provider: providerId, funding: source });
    } catch (err) {
      if (err instanceof ConsumerFundingRequiredError) {
        res.status(402).json({ error: err.message, code: 'insufficient_credits' });
        return;
      }
      res.status(403).json({ error: err instanceof Error ? err.message : 'Copilot chat failed' });
    }
  });
}
