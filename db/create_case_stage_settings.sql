-- Migration: create dedicated case_stage_settings table used as a safe fallback
-- Run this in the Supabase SQL editor (or via psql) as the DB admin/service role.

BEGIN;

CREATE TABLE IF NOT EXISTS public.case_stage_settings (
  case_id text PRIMARY KEY,
  stage_activation jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Optional index for faster lookups
CREATE INDEX IF NOT EXISTS idx_case_stage_settings_case_id ON public.case_stage_settings(case_id);

COMMIT;
