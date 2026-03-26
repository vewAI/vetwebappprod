-- Migration: create WebAuthn tables in PUBLIC schema (no schema exposure needed)
-- Run this in Supabase SQL editor or via psql
-- Replaces webauthn schema approach - use this if you get PGRST106 schema error

-- 1) Create challenges table - stores one-time challenges for registration/auth
CREATE TABLE IF NOT EXISTS public.webauthn_challenges (
  id         uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id    uuid NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  value      text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT webauthn_challenges_pkey PRIMARY KEY (id),
  CONSTRAINT webauthn_challenges_value_key UNIQUE (value)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_webauthn_challenges_value ON public.webauthn_challenges (value);
CREATE INDEX IF NOT EXISTS idx_webauthn_challenges_user_id ON public.webauthn_challenges (user_id);

-- 2) Create credentials table - stores verified passkey public keys
CREATE TABLE IF NOT EXISTS public.webauthn_credentials (
  id                       uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id                  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  friendly_name            text,
  credential_type          text NOT NULL DEFAULT 'public-key',
  credential_id            varchar NOT NULL,
  public_key               text NOT NULL,
  aaguid                   varchar NOT NULL DEFAULT '00000000-0000-0000-0000-000000000000',
  sign_count               integer NOT NULL,
  transports               text[] NOT NULL DEFAULT '{}',
  user_verification_status text NOT NULL DEFAULT 'verified',
  device_type              text NOT NULL DEFAULT 'multi_device',
  backup_state             text NOT NULL DEFAULT 'not_backed_up',
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  last_used_at             timestamptz,
  CONSTRAINT webauthn_credentials_pkey PRIMARY KEY (id),
  CONSTRAINT webauthn_credentials_credential_id_key UNIQUE (credential_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_webauthn_credentials_credential_id ON public.webauthn_credentials (credential_id);
CREATE INDEX IF NOT EXISTS idx_webauthn_credentials_user_id ON public.webauthn_credentials (user_id);

-- 3) Row Level Security for credentials
ALTER TABLE public.webauthn_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "webauthn_credentials_select_own"
  ON public.webauthn_credentials
  FOR SELECT
  USING (auth.uid() = user_id);

-- 4) Row Level Security for challenges (no user policies - service role only)
ALTER TABLE public.webauthn_challenges ENABLE ROW LEVEL SECURITY;

-- 5) Grant service role full access (RLS bypassed by service role)
GRANT ALL ON public.webauthn_credentials TO service_role;
GRANT ALL ON public.webauthn_challenges TO service_role;
GRANT SELECT ON public.webauthn_credentials TO authenticated;

-- NOTE: Apply this migration in your Supabase project's SQL editor or via:
--   psql $DATABASE_URL -f db/create_webauthn_public_tables.sql
--
-- If you previously ran create_webauthn_tables.sql (webauthn schema), you can drop it:
--   DROP SCHEMA IF EXISTS webauthn CASCADE;
