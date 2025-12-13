-- Create case_timepoints table for Phase 4B
-- We use IF NOT EXISTS for the table, but we also need to ensure columns exist if the table was created previously without them.

CREATE TABLE IF NOT EXISTS case_timepoints (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Safely add columns if they don't exist
DO $$
BEGIN
    ALTER TABLE case_timepoints ADD COLUMN IF NOT EXISTS sequence_index integer NOT NULL DEFAULT 0;
    ALTER TABLE case_timepoints ADD COLUMN IF NOT EXISTS label text NOT NULL DEFAULT 'New Timepoint';
    ALTER TABLE case_timepoints ADD COLUMN IF NOT EXISTS summary text;
    ALTER TABLE case_timepoints ADD COLUMN IF NOT EXISTS available_after_hours integer;
    ALTER TABLE case_timepoints ADD COLUMN IF NOT EXISTS after_stage_id text;
    ALTER TABLE case_timepoints ADD COLUMN IF NOT EXISTS persona_role_key text;
    ALTER TABLE case_timepoints ADD COLUMN IF NOT EXISTS stage_prompt text;
EXCEPTION
    WHEN duplicate_column THEN RAISE NOTICE 'column already exists';
END $$;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_case_timepoints_case_id ON case_timepoints(case_id);
CREATE INDEX IF NOT EXISTS idx_case_timepoints_sequence ON case_timepoints(case_id, sequence_index);

-- RLS Policies
ALTER TABLE case_timepoints ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts when re-running
DROP POLICY IF EXISTS "Admins and Professors can view all timepoints" ON case_timepoints;
DROP POLICY IF EXISTS "Authenticated users can view timepoints" ON case_timepoints;
DROP POLICY IF EXISTS "Admins and Professors can insert timepoints" ON case_timepoints;
DROP POLICY IF EXISTS "Admins and Professors can update timepoints" ON case_timepoints;
DROP POLICY IF EXISTS "Admins and Professors can delete timepoints" ON case_timepoints;

-- Re-create policies
CREATE POLICY "Admins and Professors can view all timepoints" ON case_timepoints
  FOR SELECT USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE role IN ('admin', 'professor')
    )
  );

CREATE POLICY "Authenticated users can view timepoints" ON case_timepoints
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins and Professors can insert timepoints" ON case_timepoints
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT id FROM profiles WHERE role IN ('admin', 'professor')
    )
  );

CREATE POLICY "Admins and Professors can update timepoints" ON case_timepoints
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE role IN ('admin', 'professor')
    )
  );

CREATE POLICY "Admins and Professors can delete timepoints" ON case_timepoints
  FOR DELETE USING (
    auth.uid() IN (
      SELECT id FROM profiles WHERE role IN ('admin', 'professor')
    )
  );
