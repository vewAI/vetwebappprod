-- Migration: create global_personas table for shared role personas
-- Each non-owner persona is stored once globally and referenced by cases.

CREATE TABLE IF NOT EXISTS public.global_personas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_key text NOT NULL UNIQUE,
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

CREATE OR REPLACE FUNCTION public.set_global_personas_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_global_personas_updated_at ON public.global_personas;
CREATE TRIGGER set_global_personas_updated_at
BEFORE UPDATE ON public.global_personas
FOR EACH ROW
EXECUTE FUNCTION public.set_global_personas_updated_at();

GRANT SELECT, INSERT, UPDATE ON public.global_personas TO authenticated;
