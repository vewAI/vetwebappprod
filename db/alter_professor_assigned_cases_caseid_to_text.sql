-- Alter professor_assigned_cases.case_id to text to match cases.id values
BEGIN;

-- If there is a foreign key constraint, drop it first (adjust name if needed)
DO $$
DECLARE
  fk_name text;
BEGIN
  SELECT tc.constraint_name INTO fk_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
  WHERE tc.table_schema = 'public'
    AND tc.table_name = 'professor_assigned_cases'
    AND kcu.column_name = 'case_id'
    AND tc.constraint_type = 'FOREIGN KEY'
  LIMIT 1;

  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.professor_assigned_cases DROP CONSTRAINT %I', fk_name);
    RAISE NOTICE 'Dropped foreign key constraint %', fk_name;
  ELSE
    RAISE NOTICE 'No foreign key constraint found on professor_assigned_cases.case_id';
  END IF;
END$$;

-- Alter type to text (safe cast from uuid to text)
ALTER TABLE IF EXISTS public.professor_assigned_cases
  ALTER COLUMN case_id TYPE text USING case_id::text;

-- Create index to help lookups
CREATE INDEX IF NOT EXISTS idx_professor_assigned_cases_case_id ON public.professor_assigned_cases (case_id);

COMMIT;

-- NOTE: Review this migration before applying. If your production DB expects UUIDs and
-- referential integrity, consider converting the `cases.id` values or re-adding a
-- proper FK after aligning types.