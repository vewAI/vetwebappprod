-- Backfill owner_id for existing cases to the first admin user found in profiles
-- Run this in Supabase SQL editor or via your migration tooling.

-- 1) Ensure owner_id column exists (use uuid type; change to text if your user ids are text)
ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS owner_id uuid;

-- 2) Find a single admin user and backfill owner_id for cases where it's NULL
WITH admin_user AS (
  SELECT user_id::uuid AS uid
  FROM public.profiles
  WHERE role = 'admin'
  LIMIT 1
)
UPDATE public.cases
SET owner_id = (SELECT uid FROM admin_user)
WHERE owner_id IS NULL
  AND (SELECT uid FROM admin_user) IS NOT NULL;

-- 3) Diagnostic: how many cases now have owners
SELECT COUNT(*) AS cases_with_owner FROM public.cases WHERE owner_id IS NOT NULL;
