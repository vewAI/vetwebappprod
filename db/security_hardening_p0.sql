-- P0 security hardening: profile authorization boundary
-- Apply this migration in the production Supabase SQL editor/migration flow,
-- then audit existing profiles for unexpected roles.

CREATE OR REPLACE FUNCTION public.current_profile_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.current_profile_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_profile_role() TO authenticated;

CREATE OR REPLACE FUNCTION public.prevent_self_service_profile_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Service-role/admin backend operations have no end-user auth.uid().
  IF auth.uid() IS NULL OR public.current_profile_role() = 'admin' THEN
    RETURN NEW;
  END IF;

  IF auth.uid() = OLD.user_id AND (
    (to_jsonb(NEW)->>'role') IS DISTINCT FROM (to_jsonb(OLD)->>'role') OR
    (to_jsonb(NEW)->>'institution_id') IS DISTINCT FROM (to_jsonb(OLD)->>'institution_id') OR
    (to_jsonb(NEW)->>'force_password_change') IS DISTINCT FROM (to_jsonb(OLD)->>'force_password_change')
  ) THEN
    RAISE EXCEPTION 'Users cannot modify security-controlled profile fields';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_self_service_profile_escalation ON public.profiles;
CREATE TRIGGER prevent_self_service_profile_escalation
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_self_service_profile_escalation();

DROP POLICY IF EXISTS "profiles_owner_select_update" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Professors can update student profiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;

CREATE POLICY "profiles_select_own_or_admin"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.current_profile_role() = 'admin');

CREATE POLICY "profiles_update_own_or_admin"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id OR public.current_profile_role() = 'admin')
WITH CHECK (auth.uid() = user_id OR public.current_profile_role() = 'admin');

-- Profiles are created by the auth trigger or trusted server routes. Do not
-- grant authenticated users direct INSERT access to profile rows.
REVOKE INSERT ON public.profiles FROM authenticated;
GRANT SELECT, UPDATE ON public.profiles TO authenticated;
