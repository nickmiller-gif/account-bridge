import type { FundingPolicy } from '@account-bridge/core';

export type PlanId = 'free' | 'pro' | 'business';
export type PlanStatus = 'active' | 'trialing' | 'past_due' | 'canceled';

export interface PlatformPlan {
  id: PlanId;
  name: string;
  /** Monthly price in cents (USD); 0 = free */
  priceCents: number;
  maxApps: number;
  maxMonthlyRequests: number;
  walletEnabled: boolean;
  stripePriceId?: string;
}

export interface PlatformHost {
  id: string;
  email: string;
  name: string;
  planId: PlanId;
  planStatus: PlanStatus;
  hostTokenHash: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  createdAt: string;
}

export interface PlatformApp {
  id: string;
  hostId: string;
  slug: string;
  displayName: string;
  publishableKey: string;
  secretKeyHash: string;
  encryptionSecret: string;
  fundingPolicy: FundingPolicy;
  status: 'active' | 'suspended';
  monthlyRequestCount: number;
  createdAt: string;
}

export interface CreateHostParams {
  email: string;
  name: string;
}

export interface CreateHostResult {
  host: PlatformHost;
  /** Shown once — `Authorization: Bearer ab_host_…` for platform API */
  hostToken: string;
}

export interface CreateAppParams {
  hostId: string;
  slug: string;
  displayName: string;
  fundingPolicy?: FundingPolicy;
}

export interface CreateAppResult {
  app: PlatformApp;
  /** Shown once — server-side tenant auth */
  secretKey: string;
}

export interface PlatformStore {
  createHost(params: CreateHostParams): Promise<CreateHostResult>;
  findHostByToken(hostToken: string): Promise<PlatformHost | null>;
  findHostById(hostId: string): Promise<PlatformHost | null>;
  updateHostPlan(
    hostId: string,
    patch: Partial<Pick<PlatformHost, 'planId' | 'planStatus' | 'stripeCustomerId' | 'stripeSubscriptionId'>>,
  ): Promise<PlatformHost>;

  createApp(params: CreateAppParams): Promise<CreateAppResult>;
  listAppsForHost(hostId: string): Promise<PlatformApp[]>;
  findAppBySlug(slug: string): Promise<PlatformApp | null>;
  findAppByPublishableKey(publishableKey: string): Promise<PlatformApp | null>;
  findAppBySecretKey(secretKey: string): Promise<PlatformApp | null>;
  incrementAppUsage(appId: string): Promise<void>;
  listAllApps(): Promise<PlatformApp[]>;
}

export const PLATFORM_SQL_MIGRATION = `
CREATE TABLE IF NOT EXISTS platform_hosts (
  id text PRIMARY KEY,
  email text NOT NULL UNIQUE,
  name text NOT NULL,
  plan_id text NOT NULL DEFAULT 'free',
  plan_status text NOT NULL DEFAULT 'active',
  host_token_hash text NOT NULL,
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS platform_apps (
  id text PRIMARY KEY,
  host_id text NOT NULL REFERENCES platform_hosts(id) ON DELETE CASCADE,
  slug text NOT NULL UNIQUE,
  display_name text NOT NULL,
  publishable_key text NOT NULL UNIQUE,
  secret_key_hash text NOT NULL,
  encryption_secret text NOT NULL,
  funding_policy_json jsonb NOT NULL DEFAULT '{"mode":"byok"}',
  status text NOT NULL DEFAULT 'active',
  monthly_request_count bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS platform_apps_host_idx ON platform_apps (host_id);
`;
