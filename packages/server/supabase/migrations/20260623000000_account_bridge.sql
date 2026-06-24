-- Supabase reference migration for Account Bridge v0.3
-- Apply via Supabase SQL editor or supabase db push

CREATE TABLE IF NOT EXISTS public.account_bridge_credentials (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider_id text NOT NULL,
  encrypted_payload bytea NOT NULL,
  auth_kind text NOT NULL DEFAULT 'api_key' CHECK (auth_kind IN ('api_key', 'oauth')),
  validated_at timestamptz NOT NULL DEFAULT now(),
  default_model text,
  label text,
  PRIMARY KEY (user_id, provider_id)
);

CREATE TABLE IF NOT EXISTS public.account_bridge_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  default_provider_id text
);

ALTER TABLE public.account_bridge_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_bridge_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY account_bridge_credentials_select ON public.account_bridge_credentials
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY account_bridge_credentials_insert ON public.account_bridge_credentials
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY account_bridge_credentials_update ON public.account_bridge_credentials
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY account_bridge_credentials_delete ON public.account_bridge_credentials
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY account_bridge_preferences_all ON public.account_bridge_preferences
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
