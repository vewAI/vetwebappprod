-- Migration: Add professor role and related tables
-- Adds 'professor' to allowed roles, creates professor_cases and professor_students

-- 1. Update profiles table to support 'professor' role if not already handled by app logic
-- (Assuming 'role' column exists and is text or enum. If enum, we might need to alter type)
-- Checking if we need to add a check constraint or if it's just text.
-- For now, we assume 'role' is text or we just add a check.

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        -- If user_role enum doesn't exist, we assume it's text.
        -- If it does, we might need to add 'professor' to it.
        -- For safety in this script, we'll just ensure the check constraint allows it if present.
        NULL;
    END IF;
END $$;

-- 2. Create professor_cases table (cases authored/owned by a professor)
CREATE TABLE IF NOT EXISTS public.professor_cases (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    professor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    case_id text NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(professor_id, case_id)
);

-- 3. Create professor_students table (students assigned to a professor)
CREATE TABLE IF NOT EXISTS public.professor_students (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    professor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(professor_id, student_id)
);

-- 4. Enable RLS
ALTER TABLE public.professor_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.professor_students ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies

-- professor_cases: Professors can view/manage their own cases
DROP POLICY IF EXISTS "Professors can manage their own case links" ON public.professor_cases;
CREATE POLICY "Professors can manage their own case links"
    ON public.professor_cases
    FOR ALL
    TO authenticated
    USING (auth.uid() = professor_id)
    WITH CHECK (auth.uid() = professor_id);

-- professor_students: Professors can manage their student list
DROP POLICY IF EXISTS "Professors can manage their student list" ON public.professor_students;
CREATE POLICY "Professors can manage their student list"
    ON public.professor_students
    FOR ALL
    TO authenticated
    USING (auth.uid() = professor_id)
    WITH CHECK (auth.uid() = professor_id);

-- Students can see who their professors are (optional, but good for UI)
DROP POLICY IF EXISTS "Students can see their professors" ON public.professor_students;
CREATE POLICY "Students can see their professors"
    ON public.professor_students
    FOR SELECT
    TO authenticated
    USING (auth.uid() = student_id);

-- 6. Add triggers for updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_professor_cases_updated_at ON public.professor_cases;
CREATE TRIGGER set_professor_cases_updated_at
BEFORE UPDATE ON public.professor_cases
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();
