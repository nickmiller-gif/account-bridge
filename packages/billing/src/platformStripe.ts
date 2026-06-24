import type { PlanId } from '@account-bridge/platform';
import { PLATFORM_PLANS } from '@account-bridge/platform';

export interface PlatformStripeConfig {
  secretKey: string;
  webhookSecret: string;
  baseUrl: string;
  /** Optional Stripe Price IDs per plan (preferred over price_data) */
  priceIds?: Partial<Record<PlanId, string>>;
}

export interface CreateSubscriptionCheckoutParams {
  hostId: string;
  email: string;
  planId: Exclude<PlanId, 'free'>;
  successPath?: string;
  cancelPath?: string;
}

export interface CreateSubscriptionCheckoutResult {
  url: string;
  sessionId: string;
}

async function loadStripe(secretKey: string) {
  try {
    const mod = await import('stripe');
    return new mod.default(secretKey);
  } catch {
    throw new Error('Stripe is not installed. Add stripe as a dependency on the platform host.');
  }
}

export async function createPlatformSubscriptionCheckout(
  config: PlatformStripeConfig,
  params: CreateSubscriptionCheckoutParams,
): Promise<CreateSubscriptionCheckoutResult> {
  const plan = PLATFORM_PLANS[params.planId];
  const stripe = await loadStripe(config.secretKey);
  const successPath = params.successPath ?? '/platform/billing/success';
  const cancelPath = params.cancelPath ?? '/platform/billing/cancel';
  const priceId = config.priceIds?.[params.planId];

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer_email: params.email,
    line_items: priceId
      ? [{ price: priceId, quantity: 1 }]
      : [
          {
            price_data: {
              currency: 'usd',
              product_data: { name: `Account Bridge ${plan.name}` },
              unit_amount: plan.priceCents,
              recurring: { interval: 'month' },
            },
            quantity: 1,
          },
        ],
    metadata: {
      hostId: params.hostId,
      planId: params.planId,
      kind: 'platform_subscription',
    },
    subscription_data: {
      metadata: {
        hostId: params.hostId,
        planId: params.planId,
      },
    },
    success_url: `${config.baseUrl.replace(/\/$/, '')}${successPath}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${config.baseUrl.replace(/\/$/, '')}${cancelPath}`,
  });

  if (!session.url) throw new Error('Stripe checkout session missing url');
  return { url: session.url, sessionId: session.id };
}

export interface PlatformSubscriptionWebhookResult {
  handled: boolean;
  hostId?: string;
  planId?: PlanId;
  planStatus?: 'active' | 'past_due' | 'canceled';
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
}

export async function handlePlatformSubscriptionWebhook(
  config: PlatformStripeConfig,
  rawBody: Buffer | string,
  signature: string,
): Promise<PlatformSubscriptionWebhookResult> {
  const stripe = await loadStripe(config.secretKey);
  const event = stripe.webhooks.constructEvent(rawBody, signature, config.webhookSecret);

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as {
      mode?: string;
      metadata?: Record<string, string>;
      customer?: string;
      subscription?: string;
    };
    if (session.metadata?.kind !== 'platform_subscription') {
      return { handled: false };
    }
    const hostId = session.metadata.hostId;
    const planId = session.metadata.planId as PlanId | undefined;
    if (!hostId || !planId || planId === 'free') return { handled: false };
    return {
      handled: true,
      hostId,
      planId,
      planStatus: 'active',
      stripeCustomerId: typeof session.customer === 'string' ? session.customer : undefined,
      stripeSubscriptionId:
        typeof session.subscription === 'string' ? session.subscription : undefined,
    };
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as { metadata?: Record<string, string> };
    const hostId = sub.metadata?.hostId;
    if (!hostId) return { handled: false };
    return { handled: true, hostId, planId: 'free', planStatus: 'canceled' };
  }

  if (event.type === 'customer.subscription.updated') {
    const sub = event.data.object as {
      metadata?: Record<string, string>;
      status?: string;
    };
    const hostId = sub.metadata?.hostId;
    const planId = sub.metadata?.planId as PlanId | undefined;
    if (!hostId) return { handled: false };
    const planStatus =
      sub.status === 'active' || sub.status === 'trialing'
        ? 'active'
        : sub.status === 'past_due'
          ? 'past_due'
          : 'canceled';
    return { handled: true, hostId, planId, planStatus };
  }

  return { handled: false };
}
