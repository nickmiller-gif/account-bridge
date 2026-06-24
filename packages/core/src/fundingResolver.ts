import { assertConsumerCreditsReady } from './consumerCredits.js';
import { ConsumerCreditsRequiredError, ConsumerFundingRequiredError, NotConnectedError } from './errors.js';
import type {
  AccountBridge,
  ChatClient,
  FundingPolicy,
  FundingSourceKind,
  ProviderId,
  WalletStore,
} from './types.js';
import type { HostKeyPool } from './hostKeyPool.js';
import { DEFAULT_FUNDING_POLICY } from './fundingPolicy.js';

export interface ResolvedFunding {
  source: FundingSourceKind;
  providerId: ProviderId;
  client: ChatClient;
}

export interface ResolveFundingSourceOptions {
  bridge: AccountBridge;
  policy?: FundingPolicy;
  wallet?: WalletStore;
  hostKeyPool?: HostKeyPool;
  appId: string;
  userId: string;
  providerId?: ProviderId;
  /** Pre-auth estimate for wallet mode (microcredits) */
  estimatedMicrocredits?: number;
}

const DEFAULT_WALLET_ESTIMATE = 1000;

async function resolveByok(
  bridge: AccountBridge,
  providerId?: ProviderId,
): Promise<ResolvedFunding> {
  const resolvedId = await assertConsumerCreditsReady(bridge, providerId);
  const { client } = await bridge.resolveClient(resolvedId);
  return { source: 'byok', providerId: resolvedId, client };
}

async function resolveWallet(
  options: ResolveFundingSourceOptions,
): Promise<ResolvedFunding> {
  const { wallet, hostKeyPool, appId, userId, providerId } = options;
  if (!wallet) {
    throw new ConsumerFundingRequiredError(
      'Wallet funding is not configured for this host. Enable wallet in fundingPolicy.',
    );
  }
  if (!hostKeyPool) {
    throw new ConsumerFundingRequiredError(
      'Host key pool is not configured. Set ACCOUNT_BRIDGE_POOL_* env vars on the server.',
    );
  }

  const estimate = options.estimatedMicrocredits ?? DEFAULT_WALLET_ESTIMATE;
  await wallet.assertSufficientBalance(userId, appId, estimate);

  let poolProvider = providerId;
  if (!poolProvider || !hostKeyPool.has(poolProvider)) {
    const candidates: ProviderId[] = ['openai', 'anthropic', 'gemini', 'groq'];
    poolProvider = candidates.find((id) => hostKeyPool.has(id));
    if (!poolProvider) {
      throw new ConsumerFundingRequiredError(
        'No host pool credentials available. Configure ACCOUNT_BRIDGE_POOL_OPENAI_KEY (or similar) on the server.',
      );
    }
  }

  const { client, providerId: resolvedId } = await hostKeyPool.resolveClient(poolProvider);
  return { source: 'wallet', providerId: resolvedId, client };
}

/**
 * Resolve how an AI request should be funded: BYOK consumer credentials or wallet + host pool.
 */
export async function resolveFundingSource(
  options: ResolveFundingSourceOptions,
): Promise<ResolvedFunding> {
  const policy = options.policy ?? DEFAULT_FUNDING_POLICY;
  const mode = policy.mode;

  if (mode === 'byok') {
    return resolveByok(options.bridge, options.providerId);
  }

  if (mode === 'wallet') {
    return resolveWallet(options);
  }

  // auto: BYOK first, wallet fallback
  try {
    return await resolveByok(options.bridge, options.providerId);
  } catch (err) {
    if (
      err instanceof ConsumerCreditsRequiredError ||
      err instanceof NotConnectedError
    ) {
      return resolveWallet(options);
    }
    throw err;
  }
}
