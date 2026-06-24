#!/usr/bin/env node
import { startAccountBridgeProxy } from './index.js';

function readArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

const upstream = readArg('--upstream') ?? readArg('-u');
const sessionToken = readArg('--session-token') ?? process.env.ACCOUNT_BRIDGE_SESSION_TOKEN;
const port = Number(readArg('--port') ?? readArg('-p') ?? '11434');
const appId = readArg('--app-id') ?? 'default';

if (!upstream || !sessionToken) {
  console.error(`Usage: account-bridge-proxy --upstream https://myapp.com --session-token "$JWT" [--port 11434] [--app-id my-app]`);
  process.exit(1);
}

const { port: bound } = await startAccountBridgeProxy({
  upstream,
  sessionToken,
  port,
  appId,
});

console.log(`Account Bridge proxy listening on http://127.0.0.1:${bound}/v1`);
console.log(`Point OpenAI SDK baseURL to http://127.0.0.1:${bound}/v1`);
