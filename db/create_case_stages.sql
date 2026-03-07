BEGIN;

CREATE TABLE IF NOT EXISTS public.case_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id text NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  sort_order integer NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  persona_role_key text NOT NULL DEFAULT 'owner',
  role_label text,
  role_info_key text,
  feedback_prompt_key text,
  stage_prompt text,
  transition_message text,
  is_active boolean NOT NULL DEFAULT true,
  min_user_turns integer DEFAULT 0,
  min_assistant_turns integer DEFAULT 0,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(case_id, sort_order)
);

CREATE INDEX IF NOT EXISTS idx_case_stages_case_id ON public.case_stages(case_id);
CREATE INDEX IF NOT EXISTS idx_case_stages_active ON public.case_stages(case_id, is_active, sort_order);

CREATE OR REPLACE FUNCTION update_case_stages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_case_stages_updated_at ON public.case_stages;
CREATE TRIGGER update_case_stages_updated_at
  BEFORE UPDATE ON public.case_stages
  FOR EACH ROW EXECUTE FUNCTION update_case_stages_updated_at();

ALTER TABLE public.case_stages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read case stages" ON public.case_stages;
CREATE POLICY "Anyone can read case stages"
  ON public.case_stages FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role can manage case stages" ON public.case_stages;
CREATE POLICY "Service role can manage case stages"
  ON public.case_stages FOR ALL USING (auth.role() = 'service_role');

COMMIT;
