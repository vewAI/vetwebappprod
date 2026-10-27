-- Year groups (per institution), academic year-end date, and profile/session FKs.
-- Run this in the Supabase SQL editor.

-- 1. Academic year end on institutions (default 31 July)
ALTER TABLE public.institutions
  ADD COLUMN IF NOT EXISTS academic_year_end_month integer NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS academic_year_end_day integer NOT NULL DEFAULT 31;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'institutions_academic_year_end_month_check'
  ) THEN
    ALTER TABLE public.institutions
      ADD CONSTRAINT institutions_academic_year_end_month_check
      CHECK (academic_year_end_month BETWEEN 1 AND 12);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'institutions_academic_year_end_day_check'
  ) THEN
    ALTER TABLE public.institutions
      ADD CONSTRAINT institutions_academic_year_end_day_check
      CHECK (academic_year_end_day BETWEEN 1 AND 31);
  END IF;
END $$;

-- 2. Year groups
CREATE TABLE IF NOT EXISTS public.year_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id uuid NOT NULL REFERENCES public.institutions(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (institution_id, name)
);

CREATE INDEX IF NOT EXISTS idx_year_groups_institution_id ON public.year_groups(institution_id);

ALTER TABLE public.year_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read year groups" ON public.year_groups;
CREATE POLICY "Authenticated read year groups"
  ON public.year_groups
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins manage year groups" ON public.year_groups;
CREATE POLICY "Admins manage year groups"
  ON public.year_groups
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- 3. Profile assignment
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS year_group_id uuid REFERENCES public.year_groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_year_group_id ON public.profiles(year_group_id);

-- 4. Session year group (nullable so existing rows keep working)
ALTER TABLE public.case_sessions
  ADD COLUMN IF NOT EXISTS year_group_id uuid REFERENCES public.year_groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_case_sessions_year_group_id ON public.case_sessions(year_group_id);
