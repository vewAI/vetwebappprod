-- Fix RLS policies for case_timepoints
-- The previous policies incorrectly compared auth.uid() with profiles.id instead of profiles.user_id

DROP POLICY IF EXISTS "Admins and Professors can insert timepoints" ON case_timepoints;
DROP POLICY IF EXISTS "Admins and Professors can update timepoints" ON case_timepoints;
DROP POLICY IF EXISTS "Admins and Professors can delete timepoints" ON case_timepoints;
DROP POLICY IF EXISTS "Admins and Professors can view all timepoints" ON case_timepoints;

-- Re-create policies with correct user_id check

CREATE POLICY "Admins and Professors can view all timepoints" ON case_timepoints
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role IN ('admin', 'professor')
    )
  );

CREATE POLICY "Admins and Professors can insert timepoints" ON case_timepoints
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role IN ('admin', 'professor')
    )
  );

CREATE POLICY "Admins and Professors can update timepoints" ON case_timepoints
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role IN ('admin', 'professor')
    )
  );

CREATE POLICY "Admins and Professors can delete timepoints" ON case_timepoints
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.user_id = auth.uid() 
      AND profiles.role IN ('admin', 'professor')
    )
  );
