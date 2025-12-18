-- Add force_password_change column to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS force_password_change boolean DEFAULT false;

-- Update existing profiles to false (already handled by default, but good to be explicit if needed)
-- UPDATE public.profiles SET force_password_change = false WHERE force_password_change IS NULL;

-- Allow users to update their own password change flag (e.g. set to false after changing password)
-- We need to check existing policies.
-- Usually users can update their own profile.
