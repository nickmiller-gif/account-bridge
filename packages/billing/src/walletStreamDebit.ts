import type { ProviderId, WalletPricing, WalletStore } from '@account-bridge/core';

/** Default: debit after model chunks, before `[DONE]` (best-effort if debit fails post-flush). */
export type WalletStreamDebitTiming = 'after_content' | 'before_stream';

const DEFAULT_STREAM_OUTPUT_ESTIMATE_TOKENS = 500;

export interface StreamWalletDebitUsage {
  inputTokens: number;
  outputTokens?: number;
  model?: string;
  providerId: ProviderId;
}

export interface StreamWalletDebitParams {
  wallet: WalletStore;
  userId: string;
  appId: string;
  idempotencyKey: string;
  pricing?: WalletPricing;
  usage: StreamWalletDebitUsage;
}

export function estimateStreamPreDebitUsage(
  inputCharCount: number,
  providerId: ProviderId,
  model?: string,
): StreamWalletDebitUsage {
  return {
    inputTokens: Math.ceil(inputCharCount / 4),
    outputTokens: DEFAULT_STREAM_OUTPUT_ESTIMATE_TOKENS,
    model,
    providerId,
  };
}

/**
 * Debit wallet for an SSE response.
 * - `before_stream`: throws on failure (caller returns 402 before any bytes).
 * - `after_content` (default): logs and swallows failure — response bytes may already be sent.
 */
export async function debitWalletForStream(
  timing: WalletStreamDebitTiming | undefined,
  phase: WalletStreamDebitTiming,
  params: StreamWalletDebitParams,
  onPostStreamDebitError?: (err: unknown) => void,
): Promise<void> {
  const mode = timing ?? 'after_content';
  if (mode !== phase) return;

  try {
    await params.wallet.debit({
      userId: params.userId,
      appId: params.appId,
      usage: params.usage,
      idempotencyKey: params.idempotencyKey,
      pricing: params.pricing,
    });
  } catch (err) {
    if (phase === 'after_content') {
      onPostStreamDebitError?.(err);
      return;
    }
    throw err;
  }
}

export function logPostStreamDebitFailure(err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[account-bridge] post-stream wallet debit failed (best-effort): ${message}`);
}
