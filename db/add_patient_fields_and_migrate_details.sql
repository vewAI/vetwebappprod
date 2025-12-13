-- Add patient details columns to cases table
ALTER TABLE cases 
ADD COLUMN IF NOT EXISTS patient_name text,
ADD COLUMN IF NOT EXISTS patient_age text,
ADD COLUMN IF NOT EXISTS patient_sex text;

-- Attempt to backfill from details if it contains these keys (assuming details is jsonb)
-- We use a safe check to avoid errors if details is not jsonb
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cases' AND column_name = 'details' AND data_type = 'jsonb') THEN
        UPDATE cases 
        SET 
          patient_name = COALESCE(details->>'patient_name', patient_name),
          patient_age = COALESCE(details->>'patient_age', patient_age),
          patient_sex = COALESCE(details->>'patient_sex', patient_sex);
    END IF;
END $$;
