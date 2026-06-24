import type { AccountBridgeEmbedMode } from '@account-bridge/react';

import type { DemoProviderPreset, DemoTransport } from './AppShell.js';

export type WalkthroughScenarioId =
  | 'byok-local'
  | 'wallet-credits'
  | 'remote-host'
  | 'gate-unlock'
  | 'platform-saas';

export interface WalkthroughStep {
  title: string;
  detail: string;
}

export interface WalkthroughScenario {
  id: WalkthroughScenarioId;
  title: string;
  subtitle: string;
  transport: DemoTransport;
  preset: DemoProviderPreset;
  mode: AccountBridgeEmbedMode;
  requiresWalletHost?: boolean;
  requiresNodeProxy?: boolean;
  requiresPlatformService?: boolean;
  steps: WalkthroughStep[];
  youWillSee: string[];
}

export const WALKTHROUGH_SCENARIOS: WalkthroughScenario[] = [
  {
    id: 'byok-local',
    title: '1 · BYOK in the browser',
    subtitle: 'Consumer connects their API key — keys never touch your server.',
    transport: 'local',
    preset: 'api',
    mode: 'full',
    steps: [
      {
        title: 'Open provider settings',
        detail:
          'In Full mode you see Settings on the left and Chat on the right. Pick OpenAI (recommended) or another provider.',
      },
      {
        title: 'Paste an API key and connect',
        detail:
          'Keys are encrypted in this browser tab (local transport). The host app never sees the secret.',
      },
      {
        title: 'Send a chat message',
        detail:
          'The header badge shows which provider answered. Usage bills directly to the consumer’s provider account.',
      },
      {
        title: 'Try embed modes',
        detail:
          'Switch sidebar to Gate, Chat, or Panel — same connection unlocks every mode in your app.',
      },
    ],
    youWillSee: [
      'Encrypted local storage (per tab passphrase)',
      'Provider badge on each assistant turn',
      'No server required for this path',
    ],
  },
  {
    id: 'wallet-credits',
    title: '2 · App credits (wallet)',
    subtitle: 'Consumers without API keys pay the host via prepaid credits.',
    transport: 'remote',
    preset: 'wallet',
    mode: 'full',
    requiresWalletHost: true,
    steps: [
      {
        title: 'Confirm wallet host is running',
        detail:
          'Terminal should show wallet-host on http://localhost:3456. This demo uses mock AI — no real OpenAI key needed.',
      },
      {
        title: 'Open Settings → App credits tab',
        detail:
          'You start with seeded demo balance (~$50). Funding mode is auto: BYOK if connected, else wallet.',
      },
      {
        title: 'Chat without connecting a provider',
        detail:
          'Send a message. The host pool key funds the call; your balance decreases. Reply prefix: "Demo wallet reply".',
      },
      {
        title: 'Optional: connect BYOK instead',
        detail:
          'With auto mode, a connected API key takes priority over wallet debits.',
      },
    ],
    youWillSee: [
      'My accounts vs App credits tabs',
      'Balance + ledger in wallet UI',
      'x-account-bridge-funding: wallet on API responses',
    ],
  },
  {
    id: 'remote-host',
    title: '3 · Remote host + OAuth',
    subtitle: 'Server stores encrypted credentials; browser holds only a session token.',
    transport: 'remote',
    preset: 'api',
    mode: 'full',
    requiresNodeProxy: true,
    steps: [
      {
        title: 'Start node-proxy (port 3920)',
        detail:
          'Run examples/node-proxy with PROXY_ENCRYPTION_SECRET set. Health: curl localhost:3920/health',
      },
      {
        title: 'Switch demo to Remote transport',
        detail:
          'Credentials persist per demo session token in sessionStorage — survives refresh, not other browsers.',
      },
      {
        title: 'Connect via settings',
        detail:
          'Same UI as local, but keys encrypt server-side. Gateway rejects inline sk-… tokens from clients.',
      },
      {
        title: 'Optional: Microsoft Copilot',
        detail:
          'Set MICROSOFT_OAUTH_* in node-proxy .env, restart, then pick M365 Copilot preset.',
      },
    ],
    youWillSee: [
      'CORS from vite demo → host',
      'GET /account-bridge/status funding matrix',
      'OpenAI-compatible POST /v1/chat/completions',
    ],
  },
  {
    id: 'gate-unlock',
    title: '4 · Feature gate pattern',
    subtitle: 'Hide premium UI until funding is ready.',
    transport: 'local',
    preset: 'api',
    mode: 'gate',
    steps: [
      {
        title: 'Select Gate embed mode',
        detail:
          'Children render only after funding is ready (BYOK connected or wallet balance on remote hosts).',
      },
      {
        title: 'Before connect: settings only',
        detail:
          'The green “AI feature unlocked” card stays hidden until a provider connects.',
      },
      {
        title: 'Connect a provider',
        detail:
          'Use any API key. Gate clears automatically — same hook as ConsumerFundingGate.',
      },
      {
        title: 'Ship pattern in your app',
        detail:
          'Wrap paid features in <AccountBridgeEmbed mode="gate">…</AccountBridgeEmbed>.',
      },
    ],
    youWillSee: [
      'Settings fallback until ready',
      'Host feature children appear after connect',
      'Works with useBridgeFundingReady() in custom UI',
    ],
  },
  {
    id: 'platform-saas',
    title: '5 · Cloud SaaS (hosted)',
    subtitle: 'Buy Account Bridge as a service — multi-tenant API, plans, and embed keys.',
    transport: 'remote',
    preset: 'platform',
    mode: 'full',
    requiresPlatformService: true,
    steps: [
      {
        title: 'Start the platform demo',
        detail:
          'Run npm run demo:platform — API on :3460 and host dashboard on :5176. Sign up there to create your own apps.',
      },
      {
        title: 'Embed with publishable key',
        detail:
          'Each tenant app gets ab_pk_… (browser) and ab_sk_… (server). The embed sends X-Account-Bridge-Publishable-Key automatically.',
      },
      {
        title: 'Consumer session + settings',
        detail:
          'Consumers still use your app’s session token (Bearer). Credentials encrypt per tenant — you never see their API keys.',
      },
      {
        title: 'Upgrade plans',
        detail:
          'Free · Pro ($49) · Business ($199) — Stripe checkout from the host dashboard when STRIPE_SECRET_KEY is configured.',
      },
    ],
    youWillSee: [
      'Tenant URL /t/{slug}/account-bridge/*',
      'Platform REST /platform/v1/signup · /apps · /me',
      'Monthly request limits per plan',
    ],
  },
];

export function scenarioById(id: WalkthroughScenarioId): WalkthroughScenario {
  const found = WALKTHROUGH_SCENARIOS.find((s) => s.id === id);
  if (!found) throw new Error(`Unknown scenario: ${id}`);
  return found;
}
