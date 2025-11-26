-- Creates a table to store editable prompt overrides sourced from the admin UI.
CREATE TABLE IF NOT EXISTS public.app_prompts (
  id text PRIMARY KEY,
  value text NOT NULL,
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_prompts_updated_at
  ON public.app_prompts (updated_at DESC);

CREATE OR REPLACE FUNCTION public.set_app_prompts_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_app_prompts_updated_at ON public.app_prompts;
CREATE TRIGGER set_app_prompts_updated_at
BEFORE UPDATE ON public.app_prompts
FOR EACH ROW
EXECUTE FUNCTION public.set_app_prompts_updated_at();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_prompts TO authenticated;
