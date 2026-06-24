export interface BridgeOpenAIOptions {
  gatewayUrl: string;
  userToken: string;
  providerId?: string;
}

/** Minimal OpenAI client shape for gateway-backed chat */
export interface BridgeOpenAIClient {
  baseURL: string;
  apiKey: string;
  defaultHeaders: Record<string, string>;
}

export function createBridgeOpenAI(options: BridgeOpenAIOptions): BridgeOpenAIClient {
  const baseURL = options.gatewayUrl.replace(/\/$/, '');
  const headers: Record<string, string> = {
    Authorization: `Bearer ${options.userToken}`,
  };
  if (options.providerId) {
    headers['x-account-bridge-provider'] = options.providerId;
  }
  return {
    baseURL: `${baseURL}/v1`,
    apiKey: options.userToken,
    defaultHeaders: headers,
  };
}
