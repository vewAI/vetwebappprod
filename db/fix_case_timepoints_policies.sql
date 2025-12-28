-- Fix broken RLS policies on case_timepoints
-- The previous policies compared auth.uid() (User UUID) with profiles.id (Row UUID), which are different.
-- This script updates them to compare auth.uid() with profiles.user_id.

DROP POLICY IF EXISTS "Admins and Professors can view all timepoints" ON case_timepoints;
DROP POLICY IF EXISTS "Admins and Professors can insert timepoints" ON case_timepoints;
DROP POLICY IF EXISTS "Admins and Professors can update timepoints" ON case_timepoints;
DROP POLICY IF EXISTS "Admins and Professors can delete timepoints" ON case_timepoints;

CREATE POLICY "Admins and Professors can view all timepoints" ON case_timepoints
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM profiles WHERE role IN ('admin', 'professor')
    )
  );

CREATE POLICY "Admins and Professors can insert timepoints" ON case_timepoints
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM profiles WHERE role IN ('admin', 'professor')
    )
  );

CREATE POLICY "Admins and Professors can update timepoints" ON case_timepoints
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT user_id FROM profiles WHERE role IN ('admin', 'professor')
    )
  );

CREATE POLICY "Admins and Professors can delete timepoints" ON case_timepoints
  FOR DELETE USING (
    auth.uid() IN (
      SELECT user_id FROM profiles WHERE role IN ('admin', 'professor')
    )
  );
