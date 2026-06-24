import { createBridgeVercelAiBaseUrl } from '@account-bridge/adapters/vercel-ai';

const gatewayUrl = process.env.ACCOUNT_BRIDGE_GATEWAY_URL ?? 'http://localhost:3920';
const userToken = process.env.ACCOUNT_BRIDGE_USER_TOKEN ?? 'demo-user';

const config = createBridgeVercelAiBaseUrl({ gatewayUrl, userToken });

console.log('Vercel AI SDK (@ai-sdk/openai) preset:');
console.log(`
import { createOpenAI } from '@ai-sdk/openai';

const openai = createOpenAI({
  baseURL: '${config.baseURL}',
  apiKey: '${config.apiKey}',
  headers: ${JSON.stringify(config.headers)},
});
`);
