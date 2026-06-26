import type { Express, Request, Response } from 'express';

import type { FundingPolicy, WalletStore } from '@account-bridge/core';
import { assertHostSessionToken, ConsumerCreditsRequiredError } from '@account-bridge/core';
import {
  createStripeCheckoutSession,
  DEFAULT_CREDIT_PACKS,
  handleStripeWebhook,
  type StripeBillingConfig,
} from '@account-bridge/billing';

export interface MountWalletRoutesOptions {
  app: Express;
  apiPrefix?: string;
  appId: string;
  wallet: WalletStore;
  fundingPolicy?: FundingPolicy;
  resolveUser: (req: Request) => Promise<string | null> | string | null;
  stripe?: StripeBillingConfig;
  enforceConsumerCredits?: boolean;
}

export function mountAccountBridgeWalletRoutes(options: MountWalletRoutesOptions): void {
  const prefix = options.apiPrefix ?? '/account-bridge';
  const enforce = options.enforceConsumerCredits !== false;

  async function resolveUserId(req: Request, res: Response): Promise<string | null> {
    try {
      const authHeader = String(req.headers.authorization ?? '');
      if (enforce && authHeader.startsWith('Bearer ')) {
        assertHostSessionToken(authHeader.slice('Bearer '.length).trim());
      }
      return options.resolveUser(req);
    } catch (err) {
      if (err instanceof ConsumerCreditsRequiredError) {
        res.status(403).json({ error: err.message });
        return null;
      }
      throw err;
    }
  }

  options.app.get(`${prefix}/wallet/balance`, async (req, res) => {
    const userId = await resolveUserId(req, res);
    if (!userId) {
      if (!res.headersSent) res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const balance = await options.wallet.getBalance(userId, options.appId);
    const ledger = await options.wallet.listLedger(userId, options.appId, 10);
    res.json({
      ...balance,
      ledger,
      fundingPolicy: options.fundingPolicy ?? { mode: 'byok' },
      walletEnabled: options.fundingPolicy?.wallet?.enabled ?? false,
    });
  });

  options.app.get(`${prefix}/wallet/packs`, (_req, res) => {
    res.json({
      packs: options.stripe?.creditPacks ?? DEFAULT_CREDIT_PACKS,
      walletEnabled: options.fundingPolicy?.wallet?.enabled ?? false,
    });
  });

  options.app.post(`${prefix}/wallet/checkout`, async (req, res) => {
    const userId = await resolveUserId(req, res);
    if (!userId) {
      if (!res.headersSent) res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (!options.stripe) {
      res.status(501).json({ error: 'Stripe billing is not configured on this host' });
      return;
    }
    const { packId } = req.body as { packId?: string };
    if (!packId) {
      res.status(400).json({ error: 'packId required' });
      return;
    }
    try {
      const session = await createStripeCheckoutSession(options.stripe, {
        userId,
        appId: options.appId,
        packId,
      });
      res.json(session);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Checkout failed' });
    }
  });

  options.app.post(`${prefix}/wallet/webhook`, async (req, res) => {
    if (!options.stripe) {
      res.status(501).json({ error: 'Stripe not configured' });
      return;
    }
    const signature = req.headers['stripe-signature'];
    if (typeof signature !== 'string') {
      res.status(400).json({ error: 'Missing stripe-signature' });
      return;
    }
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    if (!rawBody?.length) {
      res.status(400).json({
        error:
          'Webhook requires raw body. Mount stripeWebhookRawBody with express.raw({ type: "application/json" }) before this route.',
      });
      return;
    }
    try {
      const result = await handleStripeWebhook(options.stripe, rawBody, signature, async (credit) => {
        await options.wallet.credit({
          userId: credit.userId,
          appId: credit.appId,
          deltaMicrocredits: credit.microcredits,
          reason: 'stripe_topup',
          idempotencyKey: credit.idempotencyKey,
        });
      });
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Webhook failed' });
    }
  });

  options.app.post(`${prefix}/wallet/credit`, async (req, res) => {
    const userId = await resolveUserId(req, res);
    if (!userId) {
      if (!res.headersSent) res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (process.env.NODE_ENV === 'production') {
      res.status(403).json({ error: 'Manual credit not allowed in production' });
      return;
    }
    const { microcredits, idempotencyKey } = req.body as {
      microcredits?: number;
      idempotencyKey?: string;
    };
    if (!microcredits || microcredits <= 0) {
      res.status(400).json({ error: 'microcredits required' });
      return;
    }
    const entry = await options.wallet.credit({
      userId,
      appId: options.appId,
      deltaMicrocredits: microcredits,
      reason: 'manual_dev_credit',
      idempotencyKey: idempotencyKey ?? `dev_${Date.now()}`,
    });
    res.json({ ok: true, entry });
  });
}
