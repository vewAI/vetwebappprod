-- Creates the case_timepoints table for scheduling follow-up checkpoints within a case.
-- Run this migration in Supabase SQL editor or via your preferred migration tooling.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.case_timepoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id text NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  sequence integer NOT NULL DEFAULT 0,
  label text NOT NULL,
  summary text,
  persona_role text NOT NULL CHECK (persona_role IN ('owner', 'nurse')),
  stage_prompt text,
  available_after_hours numeric,
  after_stage_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_case_timepoints_case
  ON public.case_timepoints (case_id);

CREATE INDEX IF NOT EXISTS idx_case_timepoints_sequence
  ON public.case_timepoints (case_id, sequence);

CREATE OR REPLACE FUNCTION public.update_case_timepoints_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_case_timepoints_updated_at ON public.case_timepoints;

CREATE TRIGGER trg_case_timepoints_updated_at
BEFORE UPDATE ON public.case_timepoints
FOR EACH ROW
EXECUTE FUNCTION public.update_case_timepoints_updated_at();

GRANT SELECT ON public.case_timepoints TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.case_timepoints TO service_role;
