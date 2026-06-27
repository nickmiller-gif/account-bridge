import type { IncomingMessage, ServerResponse } from 'node:http';

import type {
  AccountBridge,
  ChatMessage,
  FundingPolicy,
  HostKeyPool,
  ProviderId,
  WalletStore,
} from '@account-bridge/core';
import {
  assertHostSessionToken,
  assertNoInlineProviderKey,
  ConsumerFundingRequiredError,
  FeatureLockedError,
  NotConnectedError,
  resolveFundingSource,
} from '@account-bridge/core';
import { estimatePromptMicrocredits, resolveWalletDebitPricing, debitWalletForStream, estimateStreamPreDebitUsage, logPostStreamDebitFailure, type WalletPricingLoader, type WalletStreamDebitTiming } from '@account-bridge/billing';

export interface GatewayRequest extends IncomingMessage {
  body?: unknown;
}

export interface AccountBridgeGatewayOptions {
  /** Resolve host user id from incoming request (after host auth) */
  resolveUser: (req: GatewayRequest) => Promise<string | null> | string | null;
  /** Factory for per-user bridge instance */
  createBridge: (userId: string) => AccountBridge;
  /** Host app id for wallet scoping */
  appId?: string;
  /** Consumer funding policy */
  fundingPolicy?: FundingPolicy;
  /** Live policy lookup (e.g. platform tenant reload from store) */
  resolveFundingPolicy?: () => Promise<FundingPolicy> | FundingPolicy;
  /** Wallet ledger (required for wallet/auto modes) */
  wallet?: WalletStore;
  /** Server-only host key pool for wallet-funded requests */
  hostKeyPool?: HostKeyPool;
  /** Optional path prefix (default '') */
  basePath?: string;
  /** Block provider API keys on gateway — force consumer-connected credentials (default true) */
  enforceConsumerCredits?: boolean;
  /** Optional SQL / custom per-app pricing (merged with fundingPolicy.pricing on debit) */
  walletPricingLoader?: WalletPricingLoader;
  /**
   * SSE wallet debit timing. Default `after_content` debits after model chunks (best-effort if debit fails post-flush).
   * Set `before_stream` to debit an upfront estimate before any SSE bytes (clean 402 on failure).
   */
  walletStreamDebit?: WalletStreamDebitTiming;
}

const PROVIDER_HEADER = 'x-account-bridge-provider';
const FUNDING_HEADER = 'x-account-bridge-funding';
const IDEMPOTENCY_HEADER = 'x-idempotency-key';

function readJsonBody(req: GatewayRequest): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (req.body !== undefined) {
      resolve(req.body);
      return;
    }
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

function openAiError(res: ServerResponse, status: number, message: string, type = 'invalid_request_error'): void {
  sendJson(res, status, { error: { message, type } });
}

function idempotencyKey(req: GatewayRequest): string {
  const header = req.headers[IDEMPOTENCY_HEADER];
  if (typeof header === 'string' && header.trim()) return header.trim();
  return `gw_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function createAccountBridgeGatewayHandlers(options: AccountBridgeGatewayOptions) {
  const basePath = (options.basePath ?? '').replace(/\/$/, '');
  const enforce = options.enforceConsumerCredits !== false;
  const appId = options.appId ?? 'default';

  async function resolveFundingPolicy(): Promise<FundingPolicy> {
    if (options.resolveFundingPolicy) {
      return options.resolveFundingPolicy();
    }
    return options.fundingPolicy ?? { mode: 'byok' };
  }

  async function walletDebitPricing(providerId: ProviderId, model?: string, policy?: FundingPolicy) {
    const fundingPolicy = policy ?? (await resolveFundingPolicy());
    return resolveWalletDebitPricing(
      options.walletPricingLoader,
      fundingPolicy?.pricing,
      appId,
      providerId,
      model,
    );
  }

  function matchPath(pathname: string, suffix: string): boolean {
    const full = `${basePath}${suffix}`;
    return pathname === full || pathname === suffix;
  }

  async function handle(req: GatewayRequest, res: ServerResponse): Promise<boolean> {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const pathname = url.pathname;

    if (req.method === 'GET' && (matchPath(pathname, '/health') || pathname === '/health')) {
      sendJson(res, 200, { ok: true });
      return true;
    }

    const userId = await options.resolveUser(req);
    if (!userId) {
      if (matchPath(pathname, '/v1/models') || matchPath(pathname, '/v1/chat/completions')) {
        openAiError(res, 401, 'Unauthorized', 'authentication_error');
        return true;
      }
    }

    if (enforce && userId) {
      const authHeader = req.headers.authorization;
      if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
        try {
          assertHostSessionToken(authHeader.slice('Bearer '.length).trim());
        } catch (err) {
          openAiError(
            res,
            403,
            err instanceof Error ? err.message : 'Consumer credentials required',
            'permission_error',
          );
          return true;
        }
      }
      if (req.headers['x-api-key']) {
        openAiError(
          res,
          403,
          'x-api-key is not accepted on the gateway. Connect consumer credentials via Account Bridge.',
          'permission_error',
        );
        return true;
      }
    }

    if (req.method === 'GET' && matchPath(pathname, '/v1/models') && userId) {
      try {
        const bridge = options.createBridge(userId);
        const headerProvider = req.headers[PROVIDER_HEADER] as string | undefined;
        const defaultProvider = headerProvider ?? (await bridge.getDefaultProvider());
        const fundingPolicy = await resolveFundingPolicy();
        if (!defaultProvider && fundingPolicy?.mode === 'byok') {
          openAiError(res, 403, 'No connected provider', 'permission_error');
          return true;
        }
        const providerId = defaultProvider ?? 'openai';
        const definition = bridge.getProviderDefinition(providerId);
        sendJson(res, 200, {
          object: 'list',
          data: [
            {
              id: definition?.displayName ?? providerId,
              object: 'model',
              owned_by: providerId,
            },
          ],
        });
      } catch (err) {
        openAiError(res, 500, err instanceof Error ? err.message : 'Gateway error');
      }
      return true;
    }

    if (req.method === 'POST' && matchPath(pathname, '/v1/chat/completions') && userId) {
      const reqIdempotency = idempotencyKey(req);
      try {
        const body = (await readJsonBody(req)) as {
          model?: string;
          messages?: ChatMessage[];
          stream?: boolean;
          max_tokens?: number;
          temperature?: number;
          api_key?: string;
          apiKey?: string;
        };
        if (enforce) {
          try {
            assertNoInlineProviderKey(body);
          } catch (err) {
            openAiError(
              res,
              403,
              err instanceof Error ? err.message : 'Consumer credentials required',
              'permission_error',
            );
            return true;
          }
        }
        const messages = body.messages ?? [];
        if (messages.length === 0) {
          openAiError(res, 400, 'messages required');
          return true;
        }

        const bridge = options.createBridge(userId);
        const headerProvider = req.headers[PROVIDER_HEADER] as ProviderId | undefined;
        const fundingPolicy = await resolveFundingPolicy();
        const estimate = estimatePromptMicrocredits(messages.length, 200, fundingPolicy?.pricing);

        const funding = await resolveFundingSource({
          bridge,
          policy: fundingPolicy,
          wallet: options.wallet,
          hostKeyPool: options.hostKeyPool,
          appId,
          userId,
          providerId: headerProvider,
          estimatedMicrocredits: estimate,
        });

        const { client, providerId, source } = funding;
        res.setHeader(FUNDING_HEADER, source);

        const chatOptions = {
          model: body.model,
          maxTokens: body.max_tokens,
          temperature: body.temperature,
        };

        if (body.stream && client.stream) {
          const inputChars = messages.reduce((sum, m) => sum + m.content.length, 0);
          const streamPricing = await walletDebitPricing(providerId, body.model, fundingPolicy);
          const streamTiming = options.walletStreamDebit;

          if (source === 'wallet' && options.wallet) {
            await debitWalletForStream(
              streamTiming,
              'before_stream',
              {
                wallet: options.wallet,
                userId,
                appId,
                idempotencyKey: reqIdempotency,
                pricing: streamPricing,
                usage: estimateStreamPreDebitUsage(inputChars, providerId, body.model),
              },
            );
          }

          res.statusCode = 200;
          res.setHeader('Content-Type', 'text/event-stream');
          res.setHeader('Cache-Control', 'no-cache');
          res.flushHeaders?.();
          const id = `chatcmpl-${Date.now()}`;
          const model = body.model ?? 'account-bridge';
          let outputChars = 0;
          for await (const delta of client.stream(messages, chatOptions)) {
            outputChars += delta.length;
            const chunk = {
              id,
              object: 'chat.completion.chunk',
              model,
              choices: [{ index: 0, delta: { content: delta }, finish_reason: null }],
            };
            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
          }

          if (source === 'wallet' && options.wallet) {
            const inputTokens = Math.ceil(inputChars / 4);
            const outputTokens = Math.ceil(outputChars / 4);
            await debitWalletForStream(
              streamTiming,
              'after_content',
              {
                wallet: options.wallet,
                userId,
                appId,
                idempotencyKey: reqIdempotency,
                pricing: streamPricing,
                usage: {
                  inputTokens,
                  outputTokens,
                  model: body.model,
                  providerId,
                },
              },
              logPostStreamDebitFailure,
            );
          }

          res.write('data: [DONE]\n\n');
          res.end();
          return true;
        }

        const result = await client.complete(messages, chatOptions);

        if (source === 'wallet' && options.wallet) {
          await options.wallet.debit({
            userId,
            appId,
            usage: {
              inputTokens: result.usage?.inputTokens,
              outputTokens: result.usage?.outputTokens,
              model: result.model,
              providerId,
            },
            idempotencyKey: reqIdempotency,
            pricing: await walletDebitPricing(providerId, result.model, fundingPolicy),
          });
        }

        sendJson(res, 200, {
          id: `chatcmpl-${Date.now()}`,
          object: 'chat.completion',
          model: result.model,
          choices: [{ index: 0, message: { role: 'assistant', content: result.content }, finish_reason: 'stop' }],
          usage: {
            prompt_tokens: result.usage?.inputTokens,
            completion_tokens: result.usage?.outputTokens,
          },
        });
      } catch (err) {
        if (err instanceof ConsumerFundingRequiredError) {
          sendJson(res, 402, {
            error: {
              message: err.message,
              type: 'insufficient_credits',
              code: 'insufficient_credits',
            },
          });
        } else if (err instanceof NotConnectedError || err instanceof FeatureLockedError) {
          openAiError(res, 403, err.message, 'permission_error');
        } else {
          openAiError(res, 500, err instanceof Error ? err.message : 'Chat failed');
        }
      }
      return true;
    }

    return false;
  }

  return { handle, providerHeader: PROVIDER_HEADER, fundingHeader: FUNDING_HEADER };
}

export type { ProviderId };
