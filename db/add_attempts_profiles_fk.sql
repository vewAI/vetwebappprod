-- Add foreign key from attempts.user_id to profiles.user_id
-- This creates a separate constraint named attempts_profiles_user_id_fkey
-- which PostgREST/Supabase can use for joins (profiles!attempts_profiles_user_id_fkey(...)).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'attempts_profiles_user_id_fkey'
  ) THEN
    EXECUTE 'ALTER TABLE public.attempts
      ADD CONSTRAINT attempts_profiles_user_id_fkey
      FOREIGN KEY (user_id)
      REFERENCES public.profiles (user_id)
      ON DELETE CASCADE';
  END IF;
END
$$;
