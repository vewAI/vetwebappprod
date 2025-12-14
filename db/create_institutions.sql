-- Migration: Create institutions table and link to profiles

-- 1. Create institutions table
CREATE TABLE IF NOT EXISTS public.institutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Add institution_id to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS institution_id uuid REFERENCES public.institutions(id) ON DELETE SET NULL;

-- 3. Enable RLS on institutions
ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for institutions
-- Admins can do everything
CREATE POLICY "Admins can manage institutions"
  ON public.institutions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Professors can view institutions (to select one)
CREATE POLICY "Professors can view institutions"
  ON public.institutions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid() AND profiles.role = 'professor'
    )
  );

-- Students can view their own institution (optional, but good for UI)
CREATE POLICY "Students can view institutions"
  ON public.institutions
  FOR SELECT
  TO authenticated
  USING (true); -- Or restrict if needed, but public read for institutions list is usually fine for authenticated users

-- 5. Update profiles policies to allow admins/professors to update institution_id
-- (Existing policies might need review, but we'll ensure admins can update any profile)

-- Ensure admins can update any profile
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Professors can update students in their institution? 
-- For now, let's stick to Admins managing institutions, or Professors managing students if requested.
-- User said: "let admins and professors assign students and professors to institutions"
-- This implies Professors can assign students to institutions.

CREATE POLICY "Professors can update student profiles"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = auth.uid() AND profiles.role = 'professor'
    )
    AND role = 'student' -- Can only update students
  );

