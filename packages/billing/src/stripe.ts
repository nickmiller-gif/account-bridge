export interface CreditPack {
  id: string;
  label: string;
  /** Price in cents (USD) */
  priceCents: number;
  /** Microcredits granted */
  microcredits: number;
}

export const DEFAULT_CREDIT_PACKS: CreditPack[] = [
  { id: 'pack_5', label: '$5 credits', priceCents: 500, microcredits: 5_000_000 },
  { id: 'pack_10', label: '$10 credits', priceCents: 1000, microcredits: 10_000_000 },
  { id: 'pack_25', label: '$25 credits', priceCents: 2500, microcredits: 25_000_000 },
];

export interface StripeBillingConfig {
  secretKey: string;
  webhookSecret: string;
  /** Public origin for success/cancel URLs */
  baseUrl: string;
  creditPacks?: CreditPack[];
}

export interface CreateCheckoutSessionParams {
  userId: string;
  appId: string;
  packId: string;
  successPath?: string;
  cancelPath?: string;
}

export interface CreateCheckoutSessionResult {
  url: string;
  sessionId: string;
}

export async function createStripeCheckoutSession(
  config: StripeBillingConfig,
  params: CreateCheckoutSessionParams,
): Promise<CreateCheckoutSessionResult> {
  const packs = config.creditPacks ?? DEFAULT_CREDIT_PACKS;
  const pack = packs.find((p) => p.id === params.packId);
  if (!pack) {
    throw new Error(`Unknown credit pack: ${params.packId}`);
  }

  let StripeCtor: new (key: string) => {
    checkout: { sessions: { create: (p: unknown) => Promise<{ url: string | null; id: string }> } };
    webhooks: { constructEvent: (body: Buffer | string, sig: string, secret: string) => { type: string; id: string; data: { object: unknown } } };
  };
  try {
    const mod = await import('stripe');
    StripeCtor = mod.default as typeof StripeCtor;
  } catch {
    throw new Error(
      'Stripe is not installed. Add stripe as a dependency or use manual wallet credits.',
    );
  }

  const stripe = new StripeCtor(config.secretKey);
  const successPath = params.successPath ?? '/account-bridge/wallet/success';
  const cancelPath = params.cancelPath ?? '/account-bridge/wallet/cancel';

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: { name: pack.label },
          unit_amount: pack.priceCents,
        },
        quantity: 1,
      },
    ],
    metadata: {
      userId: params.userId,
      appId: params.appId,
      packId: pack.id,
      microcredits: String(pack.microcredits),
    },
    success_url: `${config.baseUrl.replace(/\/$/, '')}${successPath}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${config.baseUrl.replace(/\/$/, '')}${cancelPath}`,
  });

  if (!session.url) {
    throw new Error('Stripe checkout session missing url');
  }

  return { url: session.url, sessionId: session.id };
}

export interface StripeWebhookCreditResult {
  credited: boolean;
  microcredits?: number;
  userId?: string;
  appId?: string;
}

export async function handleStripeWebhook(
  config: StripeBillingConfig,
  rawBody: Buffer | string,
  signature: string,
  creditFn: (params: {
    userId: string;
    appId: string;
    microcredits: number;
    idempotencyKey: string;
  }) => Promise<void>,
): Promise<StripeWebhookCreditResult> {
  let StripeCtor: new (key: string) => {
    webhooks: { constructEvent: (body: Buffer | string, sig: string, secret: string) => { type: string; id: string; data: { object: unknown } } };
  };
  try {
    const mod = await import('stripe');
    StripeCtor = mod.default as typeof StripeCtor;
  } catch {
    throw new Error('Stripe is not installed.');
  }

  const stripe = new StripeCtor(config.secretKey);
  const event = stripe.webhooks.constructEvent(
    rawBody,
    signature,
    config.webhookSecret,
  );

  if (event.type !== 'checkout.session.completed') {
    return { credited: false };
  }

  const session = event.data.object as {
    metadata?: Record<string, string>;
  };
  const userId = session.metadata?.userId;
  const appId = session.metadata?.appId;
  const microcredits = Number(session.metadata?.microcredits ?? 0);

  if (!userId || !appId || !microcredits) {
    return { credited: false };
  }

  await creditFn({
    userId,
    appId,
    microcredits,
    idempotencyKey: `stripe_${event.id}`,
  });

  return { credited: true, microcredits, userId, appId };
}
