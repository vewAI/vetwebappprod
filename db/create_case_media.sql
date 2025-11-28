-- Adds multimedia support for cases and attempt artifact logging.
-- Run this migration in Supabase SQL editor or psql.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

ALTER TABLE public.cases
ADD COLUMN IF NOT EXISTS media jsonb DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS public.case_attempt_artifacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id text NOT NULL,
  case_id text NOT NULL,
  media_id text,
  media_type text,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_case_attempt_artifacts_attempt
  ON public.case_attempt_artifacts (attempt_id);

CREATE INDEX IF NOT EXISTS idx_case_attempt_artifacts_case
  ON public.case_attempt_artifacts (case_id);

GRANT SELECT, INSERT ON public.case_attempt_artifacts TO authenticated;
