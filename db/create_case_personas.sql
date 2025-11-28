-- Migration: create case_personas table for storing generated persona portraits
-- Run this in Supabase SQL editor or via your migration tooling

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.case_personas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id text NOT NULL REFERENCES public.cases (id) ON DELETE CASCADE,
  role_key text NOT NULL,
  display_name text,
  prompt text,
  behavior_prompt text,
  status text NOT NULL DEFAULT 'pending',
  image_url text,
  metadata jsonb,
  generated_by text NOT NULL DEFAULT 'system',
  last_generated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_case_personas_case_role
  ON public.case_personas (case_id, role_key);

CREATE INDEX IF NOT EXISTS idx_case_personas_status
  ON public.case_personas (status);

CREATE OR REPLACE FUNCTION public.set_case_personas_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_case_personas_updated_at ON public.case_personas;
CREATE TRIGGER set_case_personas_updated_at
BEFORE UPDATE ON public.case_personas
FOR EACH ROW
EXECUTE FUNCTION public.set_case_personas_updated_at();

GRANT SELECT, INSERT, UPDATE ON public.case_personas TO authenticated;
