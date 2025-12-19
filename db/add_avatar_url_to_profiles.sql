-- Adds a nullable `avatar_url` column to `profiles` and backfills from auth.users metadata
BEGIN;

ALTER TABLE IF EXISTS profiles
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Backfill from Supabase Auth users metadata when available.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'user_metadata'
  ) THEN
    UPDATE profiles p
    SET avatar_url = COALESCE(
      u.user_metadata->> 'avatar_url',
      u.user_metadata->> 'picture',
      u.user_metadata->> 'avatar'
    )
    FROM auth.users u
    WHERE u.id = p.user_id
      AND (p.avatar_url IS NULL OR p.avatar_url = '')
      AND (
        (u.user_metadata->> 'avatar_url') IS NOT NULL OR
        (u.user_metadata->> 'picture') IS NOT NULL OR
        (u.user_metadata->> 'avatar') IS NOT NULL
      );
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'auth' AND table_name = 'users' AND column_name = 'raw_user_meta_data'
  ) THEN
    UPDATE profiles p
    SET avatar_url = COALESCE(
      u.raw_user_meta_data->> 'avatar_url',
      u.raw_user_meta_data->> 'picture',
      u.raw_user_meta_data->> 'avatar'
    )
    FROM auth.users u
    WHERE u.id = p.user_id
      AND (p.avatar_url IS NULL OR p.avatar_url = '')
      AND (
        (u.raw_user_meta_data->> 'avatar_url') IS NOT NULL OR
        (u.raw_user_meta_data->> 'picture') IS NOT NULL OR
        (u.raw_user_meta_data->> 'avatar') IS NOT NULL
      );
  ELSE
    RAISE NOTICE 'No auth.users metadata column found; skipping backfill for profiles.avatar_url';
  END IF;
END;
$$;

COMMIT;

-- Apply this in Supabase SQL editor or with psql/docker as previously described.