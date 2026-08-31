-- F4.5: Atomic job claim for the job_queue worker.
-- scripts/process_jobs.js previously did select-then-update without a lock:
-- two workers in parallel could grab and process the same job. This SECURITY
-- DEFINER RPC claims one pending job atomically (FOR UPDATE SKIP LOCKED), so
-- each job is handed to exactly one worker.
--
-- p_queue_name: claim only from this queue, or NULL to claim from any queue.
--
-- Run with: Supabase SQL Editor, or psql -f db/add_claim_pending_job.sql

CREATE OR REPLACE FUNCTION public.claim_pending_job(p_queue_name text)
RETURNS job_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job job_queue;
BEGIN
  UPDATE job_queue
    SET status = 'in_progress',
        attempt_count = attempt_count + 1,
        updated_at = now()
  WHERE id = (
    SELECT j.id
    FROM job_queue j
    WHERE j.status = 'pending'
      AND j.queue_name = COALESCE(p_queue_name, j.queue_name)
    ORDER BY j.created_at
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_pending_job(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_pending_job(text) TO service_role;
