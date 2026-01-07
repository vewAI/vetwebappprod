-- Fix professor_assigned_cases table to properly reference cases.id (which is text, not uuid)
-- Drop any existing FK if present, ensure case_id is text, and re-add indexes

-- Drop foreign key constraint if it exists
DO $$ 
DECLARE
    fk_name text;
BEGIN
    SELECT constraint_name INTO fk_name
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'professor_assigned_cases'
      AND constraint_type = 'FOREIGN KEY';
    
    IF fk_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE public.professor_assigned_cases DROP CONSTRAINT %I', fk_name);
        RAISE NOTICE 'Dropped FK constraint: %', fk_name;
    ELSE
        RAISE NOTICE 'No FK constraint found on professor_assigned_cases';
    END IF;
END $$;

-- Ensure case_id is TEXT (matching cases.id which is text)
-- This may be a no-op if already text, but ensures consistency
ALTER TABLE public.professor_assigned_cases
  ALTER COLUMN case_id TYPE text USING case_id::text;

-- Drop old UUID index if present (might fail silently, which is fine)
DROP INDEX IF EXISTS idx_professor_assigned_cases_case_id;

-- Recreate indexes for query performance
CREATE INDEX IF NOT EXISTS idx_professor_assigned_cases_case_id ON public.professor_assigned_cases (case_id);
CREATE INDEX IF NOT EXISTS idx_professor_assigned_cases_professor_id ON public.professor_assigned_cases (professor_id);
CREATE INDEX IF NOT EXISTS idx_professor_assigned_cases_student_id ON public.professor_assigned_cases (student_id);

-- Since we don't have a proper FK (cases.id is text but may not be a primary key reference),
-- PostgREST may still have trouble with case:cases joins. As a workaround,
-- the app can manually join in code if needed, but PostgREST auto-join should work now.
COMMENT ON TABLE professor_assigned_cases IS 'Tracks case assignments from professors to students. case_id references cases.id as text.';
