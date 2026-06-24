#!/usr/bin/env node
/**
 * LangChain-style demo — point ChatOpenAI baseURL at Account Bridge gateway.
 * Requires: connected provider on node-proxy + bearer token demo-user
 */
import { createBridgeOpenAI } from '@account-bridge/adapters/openai';

const gatewayUrl = process.env.ACCOUNT_BRIDGE_GATEWAY_URL ?? 'http://localhost:3920';
const userToken = process.env.ACCOUNT_BRIDGE_USER_TOKEN ?? 'demo-user';

const client = createBridgeOpenAI({ gatewayUrl, userToken });

console.log('LangChain / OpenAI SDK integration preset:');
console.log(JSON.stringify(client, null, 2));
console.log('\nUsage with openai package:');
console.log(`
import OpenAI from 'openai';
const openai = new OpenAI({
  baseURL: '${client.baseURL}',
  apiKey: '${client.apiKey}',
  defaultHeaders: ${JSON.stringify(client.defaultHeaders)},
});
const completion = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: 'Hello' }],
});
`);
