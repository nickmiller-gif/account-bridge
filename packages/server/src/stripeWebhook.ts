import type { Express, Request, Response, NextFunction } from 'express';

/**
 * Preserve raw body for Stripe webhook signature verification.
 * Mount BEFORE express.json() on the webhook route:
 *
 * app.post('/account-bridge/wallet/webhook',
 *   express.raw({ type: 'application/json' }),
 *   stripeWebhookRawBody,
 *   handler);
 */
export function stripeWebhookRawBody(req: Request, _res: Response, next: NextFunction): void {
  const raw = req.body;
  if (Buffer.isBuffer(raw)) {
    (req as Request & { rawBody: Buffer }).rawBody = raw;
    try {
      req.body = JSON.parse(raw.toString('utf8'));
    } catch {
      req.body = {};
    }
  }
  next();
}
