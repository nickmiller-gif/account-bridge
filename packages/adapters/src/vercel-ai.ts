export interface BridgeVercelAiOptions {
  gatewayUrl: string;
  userToken: string;
  providerId?: string;
}

/** Returns config for @ai-sdk/openai `createOpenAI({ baseURL, apiKey, headers })`. */
export function createBridgeVercelAiBaseUrl(options: BridgeVercelAiOptions): {
  baseURL: string;
  apiKey: string;
  headers: Record<string, string>;
} {
  const baseURL = `${options.gatewayUrl.replace(/\/$/, '')}/v1`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${options.userToken}`,
  };
  if (options.providerId) {
    headers['x-account-bridge-provider'] = options.providerId;
  }
  return { baseURL, apiKey: options.userToken, headers };
}
