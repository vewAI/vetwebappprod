-- Backfill profiles for users who exist in auth.users but not in public.profiles
-- This ensures all users appear in the User Management list

INSERT INTO public.profiles (user_id, email, role)
SELECT 
  id, 
  email, 
  'student' -- Default role
FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.profiles)
ON CONFLICT (user_id) DO NOTHING;

-- Optional: If you want to ensure the current user is an admin, you can update manually:
-- UPDATE public.profiles SET role = 'admin' WHERE email = 'your_email@example.com';
