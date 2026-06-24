import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import type { AccountBridgeGatewayOptions } from '@account-bridge/gateway';
import { createAccountBridgeGatewayHandlers } from '@account-bridge/gateway';

export interface AccountBridgeProxyOptions {
  port?: number;
  host?: string;
  /** Upstream host base URL — forwards auth to remote gateway */
  upstream: string;
  /** Consumer session JWT */
  sessionToken: string;
  appId?: string;
  /** Optional local bridge factory when running full local stack */
  gatewayOptions?: Omit<AccountBridgeGatewayOptions, 'resolveUser'>;
}

export function startAccountBridgeProxy(options: AccountBridgeProxyOptions): Promise<{
  port: number;
  close: () => Promise<void>;
}> {
  const port = options.port ?? 11434;
  const host = options.host ?? '127.0.0.1';
  const upstream = options.upstream.replace(/\/$/, '');

  const handlers =
    options.gatewayOptions &&
    createAccountBridgeGatewayHandlers({
      ...options.gatewayOptions,
      resolveUser: () => 'proxy-user',
    });

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? '/', `http://${host}`);

    if (handlers && (url.pathname.startsWith('/v1') || url.pathname === '/health')) {
      const handled = await handlers.handle(req, res);
      if (handled) return;
    }

    const targetUrl = `${upstream}${url.pathname}${url.search}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${options.sessionToken}`,
      'Content-Type': req.headers['content-type'] ?? 'application/json',
    };
    if (options.appId) headers['x-account-bridge-app-id'] = options.appId;
    const idempotency = req.headers['x-idempotency-key'];
    if (typeof idempotency === 'string') headers['x-idempotency-key'] = idempotency;

    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const body = Buffer.concat(chunks);

    const upstreamRes = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: body.length ? body : undefined,
    });

    res.statusCode = upstreamRes.status;
    upstreamRes.headers.forEach((value, key) => {
      if (key.toLowerCase() !== 'transfer-encoding') res.setHeader(key, value);
    });
    const buf = Buffer.from(await upstreamRes.arrayBuffer());
    res.end(buf);
  });

  return new Promise((resolve) => {
    server.listen(port, host, () => {
      const address = server.address();
      const listeningPort =
        typeof address === 'object' && address !== null ? address.port : port;
      resolve({
        port: listeningPort,
        close: () =>
          new Promise((res, rej) => {
            server.close((err) => (err ? rej(err) : res()));
          }),
      });
    });
  });
}
