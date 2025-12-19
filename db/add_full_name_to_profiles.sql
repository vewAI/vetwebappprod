-- Adds a nullable `full_name` column to `profiles` and backfills from auth.users.user_metadata
-- Adds a nullable `full_name` column to `profiles` and backfills from auth.users metadata
BEGIN;

ALTER TABLE IF EXISTS profiles
  ADD COLUMN IF NOT EXISTS full_name TEXT;

-- Backfill from Supabase Auth users metadata when available.
-- Different Supabase versions/use-cases store metadata in different columns
-- (e.g. user_metadata or raw_user_meta_data). Use conditional logic to avoid
-- referencing non-existent columns.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'user_metadata'
  ) THEN
    UPDATE profiles p
    SET full_name = u.user_metadata->> 'full_name'
    FROM auth.users u
    WHERE u.id = p.user_id
      AND (p.full_name IS NULL OR p.full_name = '')
      AND (u.user_metadata->> 'full_name') IS NOT NULL;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'raw_user_meta_data'
  ) THEN
    UPDATE profiles p
    SET full_name = u.raw_user_meta_data->> 'full_name'
    FROM auth.users u
    WHERE u.id = p.user_id
      AND (p.full_name IS NULL OR p.full_name = '')
      AND (u.raw_user_meta_data->> 'full_name') IS NOT NULL;
  ELSE
    RAISE NOTICE 'No auth.users metadata column found; skipping backfill for profiles.full_name';
  END IF;
END;
$$;

-- Optional index to speed lookups by full_name
CREATE INDEX IF NOT EXISTS idx_profiles_full_name ON profiles (full_name);

COMMIT;

-- NOTE: Apply this migration in your Supabase SQL editor or via psql with the service role.
-- Example (psql):
--   psql "postgresql://<db_user>:<db_pass>@<db_host>:5432/<db_name>" -f db/add_full_name_to_profiles.sql
