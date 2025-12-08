-- Migration: create profiles table and auto-create profile on auth.users insert
-- Run this in Supabase SQL editor (or via your migration tooling)

-- 1) Ensure uuid generator extension is available
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2) Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  role text DEFAULT 'student', -- allowed values: 'admin'|'professor'|'student'
  created_at timestamptz DEFAULT now()
);

-- 3) Optional: create an index on user_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles (user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email_ci ON public.profiles (lower(email));

-- 4) Trigger function: create a profile row when a new auth user is created
-- This will run whenever a user is created in auth.users (via Supabase signup)
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger AS $$
BEGIN
  -- if a profile for this user already exists, do nothing
  INSERT INTO public.profiles (user_id, email, role)
  VALUES (NEW.id, lower(NEW.email), 'student')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5) Create trigger on auth.users AFTER INSERT to populate profiles
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- 6) Row Level Security: enable RLS on profiles and add conservative policies
-- Allow users to SELECT their own profile and allow update/insert for their own row
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to insert their own profile (if not using the trigger)
CREATE POLICY "profiles_insert_own"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow owners to select and update their profile
CREATE POLICY "profiles_owner_select_update"
  ON public.profiles
  FOR ALL
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.role = 'admin'));

-- Note: The policy above allows the profile owner and any admin (profile.role='admin') to read/update/insert.

-- 7) Grant select privileges to anon/authenticated roles if you intend to query via client SDK
-- (Supabase by default uses authenticated role for logged-in users)
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;

-- 8) Add a convenience admin account (optional) — change the email to a real admin
-- INSERT INTO public.profiles (user_id, email, role) VALUES ('00000000-0000-0000-0000-000000000000', 'admin@example.com','admin');

-- IMPORTANT notes:
-- - After running this migration, signups will automatically create a profile row with role 'student'.
-- - For existing users, you may need to backfill profiles using:
--     INSERT INTO public.profiles (user_id, email, role)
--     SELECT id, email, 'student' FROM auth.users
--     ON CONFLICT (user_id) DO NOTHING;
-- - To grant admin rights to someone, update their profile row: UPDATE public.profiles SET role='admin' WHERE email='their@email.com';
