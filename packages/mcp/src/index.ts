#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

import {
  createAccountBridge,
  createDefaultProviders,
  deriveKeyFromSecret,
  type ProviderId,
} from '@account-bridge/core';
import { fileEncryptedStorage } from '@account-bridge/core/node';

function createBridge() {
  const secret = process.env.ACCOUNT_BRIDGE_ENCRYPTION_SECRET ?? 'dev-only-secret';
  const userId = process.env.ACCOUNT_BRIDGE_USER_ID ?? 'mcp-default';
  const directory = process.env.ACCOUNT_BRIDGE_STORAGE_DIR;

  return createAccountBridge({
    storage: fileEncryptedStorage({ namespace: 'mcp', directory }),
    providers: createDefaultProviders(),
    userId,
    getEncryptionKey: async () => ({
      key: await deriveKeyFromSecret(secret, userId),
    }),
  });
}

const bridge = createBridge();

const server = new Server(
  { name: 'account-bridge-mcp', version: '3.0.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'account_bridge_funding_status',
      description: 'Report BYOK connection status and optional wallet balance',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'account_bridge_wallet_balance',
      description: 'Get app credit wallet balance (when host wallet API configured)',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'account_bridge_wallet_top_up_url',
      description: 'Return instructions to top up wallet credits on the host',
      inputSchema: {
        type: 'object',
        properties: {
          baseUrl: { type: 'string', description: 'Host origin, e.g. https://myapp.com' },
        },
        required: ['baseUrl'],
      },
    },
    {
      name: 'account_bridge_list_providers',
      description: 'List AI providers and connection status for the current user',
      inputSchema: { type: 'object', properties: {} },
    },
    {
      name: 'account_bridge_connect',
      description: 'Validate and store a user-owned API key for a provider',
      inputSchema: {
        type: 'object',
        properties: {
          provider: { type: 'string', description: 'Provider id (openai, anthropic, gemini, groq, …)' },
          apiKey: { type: 'string', description: 'Provider API key (never logged)' },
        },
        required: ['provider', 'apiKey'],
      },
    },
    {
      name: 'account_bridge_disconnect',
      description: 'Remove stored credentials for a provider',
      inputSchema: {
        type: 'object',
        properties: {
          provider: { type: 'string' },
        },
        required: ['provider'],
      },
    },
    {
      name: 'account_bridge_set_default',
      description: 'Set default provider for resolveClient / gateway routing',
      inputSchema: {
        type: 'object',
        properties: {
          provider: { type: 'string', description: 'Provider id or null to clear' },
        },
        required: ['provider'],
      },
    },
    {
      name: 'account_bridge_copilot_chat',
      description: 'Multi-turn copilot chat using connected provider (messages array)',
      inputSchema: {
        type: 'object',
        properties: {
          provider: { type: 'string', description: 'Optional; uses default when omitted' },
          systemPrompt: { type: 'string', description: 'Optional system instruction' },
          messages: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                role: { type: 'string', enum: ['user', 'assistant', 'system'] },
                content: { type: 'string' },
              },
              required: ['role', 'content'],
            },
          },
          stream: { type: 'boolean', description: 'Stream tokens when supported' },
        },
        required: ['messages'],
      },
    },
    {
      name: 'account_bridge_chat',
      description: 'Run a chat completion using connected provider (default if provider omitted)',
      inputSchema: {
        type: 'object',
        properties: {
          provider: { type: 'string', description: 'Optional; uses default when omitted' },
          message: { type: 'string' },
          stream: { type: 'boolean', description: 'Stream tokens when supported' },
        },
        required: ['message'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === 'account_bridge_funding_status') {
      const providers = await bridge.listProviders();
      const defaultProvider = await bridge.getDefaultProvider();
      const connected = providers.filter((p) => p.connected);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                byokReady: connected.length > 0,
                defaultProvider,
                connectedProviders: connected.map((p) => p.providerId),
                walletNote: 'Configure host wallet API for balance; use wallet_top_up_url with baseUrl',
              },
              null,
              2,
            ),
          },
        ],
      };
    }

    if (name === 'account_bridge_wallet_balance') {
      const baseUrl = process.env.ACCOUNT_BRIDGE_HOST_URL;
      const token = process.env.ACCOUNT_BRIDGE_SESSION_TOKEN;
      if (!baseUrl || !token) {
        return {
          content: [
            {
              type: 'text',
              text: 'Set ACCOUNT_BRIDGE_HOST_URL and ACCOUNT_BRIDGE_SESSION_TOKEN for remote wallet balance.',
            },
          ],
        };
      }
      const res = await fetch(`${baseUrl.replace(/\/$/, '')}/account-bridge/wallet/balance`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.text();
      return { content: [{ type: 'text', text: body }] };
    }

    if (name === 'account_bridge_wallet_top_up_url') {
      const { baseUrl } = z.object({ baseUrl: z.string().url() }).parse(args);
      return {
        content: [
          {
            type: 'text',
            text: `Open ${baseUrl.replace(/\/$/, '')}/settings or POST ${baseUrl.replace(/\/$/, '')}/account-bridge/wallet/checkout with { packId } while signed in.`,
          },
        ],
      };
    }

    if (name === 'account_bridge_list_providers') {
      const providers = await bridge.listProviders();
      const defaultProvider = await bridge.getDefaultProvider();
      return {
        content: [{ type: 'text', text: JSON.stringify({ providers, defaultProvider }, null, 2) }],
      };
    }

    if (name === 'account_bridge_connect') {
      const { provider, apiKey } = z
        .object({ provider: z.string().min(1), apiKey: z.string().min(1) })
        .parse(args);
      await bridge.connect(provider as ProviderId, { kind: 'api_key', apiKey });
      return {
        content: [{ type: 'text', text: `Connected ${provider}` }],
      };
    }

    if (name === 'account_bridge_disconnect') {
      const { provider } = z.object({ provider: z.string().min(1) }).parse(args);
      await bridge.disconnect(provider as ProviderId);
      return {
        content: [{ type: 'text', text: `Disconnected ${provider}` }],
      };
    }

    if (name === 'account_bridge_set_default') {
      const { provider } = z.object({ provider: z.string() }).parse(args);
      await bridge.setDefaultProvider(provider === 'null' || provider === '' ? null : provider);
      return {
        content: [{ type: 'text', text: `Default provider: ${provider || 'none'}` }],
      };
    }

    if (name === 'account_bridge_copilot_chat') {
      const { provider, systemPrompt, messages, stream } = z
        .object({
          provider: z.string().optional(),
          systemPrompt: z.string().optional(),
          messages: z.array(
            z.object({
              role: z.enum(['user', 'assistant', 'system']),
              content: z.string(),
            }),
          ),
          stream: z.boolean().optional(),
        })
        .parse(args);
      const chatMessages = [
        ...(systemPrompt?.trim()
          ? [{ role: 'system' as const, content: systemPrompt.trim() }]
          : []),
        ...messages.filter((m) => m.content.trim()),
      ];
      const { client, providerId } = await bridge.resolveClient(provider as ProviderId | undefined);
      if (stream && client.stream) {
        let content = '';
        for await (const chunk of client.stream(chatMessages)) {
          content += chunk;
        }
        return { content: [{ type: 'text', text: content }] };
      }
      const result = await client.complete(chatMessages);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              { provider: providerId, model: result.model, content: result.content },
              null,
              2,
            ),
          },
        ],
      };
    }

    if (name === 'account_bridge_chat') {
      const { provider, message, stream } = z
        .object({
          provider: z.string().optional(),
          message: z.string().min(1),
          stream: z.boolean().optional(),
        })
        .parse(args);
      const { client, providerId } = await bridge.resolveClient(provider as ProviderId | undefined);
      if (stream && client.stream) {
        let content = '';
        for await (const chunk of client.stream([{ role: 'user', content: message }])) {
          content += chunk;
        }
        return { content: [{ type: 'text', text: content }] };
      }
      const result = await client.complete([{ role: 'user', content: message }]);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ provider: providerId, model: result.model, content: result.content }, null, 2),
          },
        ],
      };
    }

    return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
  } catch (err) {
    return {
      content: [{ type: 'text', text: err instanceof Error ? err.message : 'Tool failed' }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
