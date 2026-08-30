-- F4.2: Atomic Live session claim.
-- POST /api/live/session previously did select-then-insert without a lock, so
-- two tabs (or a double-open) could create two in-progress attempts for the
-- same user+case. This SECURITY DEFINER RPC serializes the claim: the second
-- caller blocks on FOR UPDATE until the first transaction commits and then
-- resumes the same attempt instead of creating a duplicate.
--
-- Run with: Supabase SQL Editor, or psql -f db/add_claim_live_attempt.sql

CREATE OR REPLACE FUNCTION public.claim_live_attempt(p_case_id text, p_user_id text)
RETURNS TABLE (attempt_id uuid, last_stage_index int, time_spent_seconds int, resumed boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing uuid;
  v_stage int;
  v_time int;
  v_new uuid;
BEGIN
  SELECT a.id, a.last_stage_index, a.time_spent_seconds
    INTO v_existing, v_stage, v_time
  FROM attempts a
  WHERE a.case_id = p_case_id
    AND a.user_id = p_user_id::uuid
    AND a.completion_status = 'in_progress'
  ORDER BY a.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF v_existing IS NOT NULL THEN
    RETURN QUERY SELECT v_existing, v_stage, COALESCE(v_time, 0), true;
    RETURN;
  END IF;

  INSERT INTO attempts (case_id, user_id, title, last_stage_index, completion_status, time_spent_seconds)
  VALUES (
    p_case_id,
    p_user_id::uuid,
    'Live — ' || to_char(now(), 'YYYY-MM-DD HH24:MI:SS'),
    0,
    'in_progress',
    0
  )
  RETURNING attempts.id INTO v_new;

  RETURN QUERY SELECT v_new, 0, 0, false;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_live_attempt(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_live_attempt(text, text) TO authenticated;
