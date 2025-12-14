-- Fix trigger to handle zombie profiles with same email
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger AS $$
BEGIN
  -- If a profile with this email already exists (zombie profile from deleted user),
  -- update it to point to the new user.
  -- Supabase Auth ensures email is unique in auth.users, so if we are here,
  -- the email is unique in auth.users, and any match in profiles must be stale.
  IF EXISTS (SELECT 1 FROM public.profiles WHERE email = NEW.email) THEN
      UPDATE public.profiles
      SET user_id = NEW.id
      WHERE email = NEW.email;
  ELSE
      INSERT INTO public.profiles (user_id, email, role)
      VALUES (NEW.id, NEW.email, 'student')
      ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
