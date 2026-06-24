import type { UsageRecord, WalletPricing } from '@account-bridge/core';

export const DEFAULT_WALLET_PRICING: WalletPricing = {
  inputPer1kTokens: 50,
  outputPer1kTokens: 150,
  minPerRequest: 100,
};

export function estimateUsageMicrocredits(
  usage: UsageRecord,
  pricing: WalletPricing = DEFAULT_WALLET_PRICING,
): number {
  const inputRate = pricing.inputPer1kTokens ?? DEFAULT_WALLET_PRICING.inputPer1kTokens!;
  const outputRate = pricing.outputPer1kTokens ?? DEFAULT_WALLET_PRICING.outputPer1kTokens!;
  const min = pricing.minPerRequest ?? DEFAULT_WALLET_PRICING.minPerRequest!;

  const inputTokens = usage.inputTokens ?? 0;
  const outputTokens = usage.outputTokens ?? 0;

  if (inputTokens === 0 && outputTokens === 0) {
    return min;
  }

  const inputCost = Math.ceil((inputTokens / 1000) * inputRate);
  const outputCost = Math.ceil((outputTokens / 1000) * outputRate);
  return Math.max(min, inputCost + outputCost);
}

export function estimatePromptMicrocredits(
  messageCount: number,
  avgCharsPerMessage = 200,
  pricing: WalletPricing = DEFAULT_WALLET_PRICING,
): number {
  const estimatedTokens = Math.ceil((messageCount * avgCharsPerMessage) / 4);
  return estimateUsageMicrocredits({ inputTokens: estimatedTokens, outputTokens: 500 }, pricing);
}
