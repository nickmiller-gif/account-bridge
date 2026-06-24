import {
  assertConsumerCreditsReady,
  consumerCreditsReady,
  type AccountBridge,
  type ProviderId,
} from '@account-bridge/core';
import { ConsumerFundingRequiredError } from '@account-bridge/core';

/**
 * Whether the consumer can run AI (BYOK connected and/or wallet balance on remote hosts).
 */
export async function bridgeFundingReady(
  bridge: AccountBridge,
  providerId?: ProviderId,
): Promise<boolean> {
  if (bridge.getFundingStatus) {
    const status = await bridge.getFundingStatus();
    return status.ready;
  }
  return consumerCreditsReady(bridge, providerId);
}

/**
 * Ensures funding is ready before chat; returns provider hint for resolveClient.
 */
export async function ensureBridgeFundingReady(
  bridge: AccountBridge,
  providerId?: ProviderId,
): Promise<ProviderId | undefined> {
  if (bridge.getFundingStatus) {
    const status = await bridge.getFundingStatus();
    if (!status.ready) {
      throw new ConsumerFundingRequiredError(
        status.walletEnabled
          ? 'Connect a provider or add app credits in Settings to continue.'
          : 'Connect a provider in Settings to continue.',
      );
    }
    return providerId ?? status.defaultProvider ?? undefined;
  }
  return assertConsumerCreditsReady(bridge, providerId);
}
