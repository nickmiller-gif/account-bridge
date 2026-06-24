#!/usr/bin/env node
import http from 'node:http';

import { startAccountBridgeProxy } from '@account-bridge/proxy';

const token = process.env.SMOKE_PROXY_TOKEN ?? 'Bearer demo';
const sessionToken = token.replace(/^Bearer\s+/i, '');

const upstream = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  if (req.url === '/v1/models') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ data: [{ id: 'mock-model' }] }));
    return;
  }
  res.writeHead(404);
  res.end();
});

await new Promise((resolve) => upstream.listen(0, '127.0.0.1', resolve));
const upstreamPort = upstream.address()?.port;
if (!upstreamPort) throw new Error('mock upstream failed to bind');

const { port, close } = await startAccountBridgeProxy({
  upstream: `http://127.0.0.1:${upstreamPort}`,
  sessionToken,
  port: 0,
  appId: 'smoke-proxy',
});

const health = await fetch(`http://127.0.0.1:${port}/health`);
if (!health.ok) {
  throw new Error(`proxy /health failed (${health.status})`);
}

const models = await fetch(`http://127.0.0.1:${port}/v1/models`, {
  headers: { Authorization: `Bearer ${sessionToken}` },
});
if (!models.ok) {
  throw new Error(`proxy /v1/models failed (${models.status})`);
}

await close();
upstream.close();
console.log('smoke:proxy OK');
