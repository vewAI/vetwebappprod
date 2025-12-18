-- Add professor_feedback column to attempts table

ALTER TABLE public.attempts
ADD COLUMN IF NOT EXISTS professor_feedback text;

-- Ensure RLS allows professors to update this column
-- We might need a policy that allows professors to UPDATE attempts where the user is their student.
-- This is complex with RLS.
-- Alternative: Use a separate table `attempt_feedback` or `professor_reviews`.
-- But adding a column is simpler if we can handle the permissions.

-- Let's check existing policies on attempts.
-- If we can't easily modify RLS for "my student's attempt", we might need to use the admin client in the API route.
-- Using admin client in API route is safer and easier than complex RLS joins.

-- So just adding the column is enough for the DB.
