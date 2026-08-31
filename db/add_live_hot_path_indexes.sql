-- Hot-path indexes for Live sessions and transcript persistence.
--
-- POST /api/live/session resumes the latest in-progress attempt with:
--   SELECT ... FROM attempts
--   WHERE case_id = ? AND user_id = ? AND completion_status = 'in_progress'
--   ORDER BY created_at DESC LIMIT 1
-- and every transcript read/write is scoped by attempt_id.
--
-- Run with: psql $SUPABASE_DB -f db/add_live_hot_path_indexes.sql
-- (or paste into the Supabase SQL editor).

CREATE INDEX IF NOT EXISTS idx_attempts_user_case_status
  ON attempts (user_id, case_id, completion_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_attempt_messages_attempt_id
  ON attempt_messages (attempt_id, timestamp);

-- Persist the persona that produced each assistant message so resumed
-- sessions keep role labels and portraits (personaRoleKey in the Message model).
ALTER TABLE attempt_messages ADD COLUMN IF NOT EXISTS persona_role_key text;

-- F4.1: Stable client-side message id so autosave can UPSERT rows in place
-- instead of DELETE + full reINSERT (O(n) churn instead of O(n²) rewrites,
-- no lost updates between racing tabs).
-- NOTE: must be a FULL unique index (no WHERE clause) — PostgREST's
-- `onConflict` cannot infer a partial index and fails with
-- "no unique or exclusion constraint matching the ON CONFLICT specification".
-- NULLs remain non-colliding in Postgres unique indexes, so legacy rows are safe.
ALTER TABLE attempt_messages ADD COLUMN IF NOT EXISTS client_msg_id text;

DROP INDEX IF EXISTS uq_attempt_messages_client_msg;
CREATE UNIQUE INDEX IF NOT EXISTS uq_attempt_messages_client_msg
  ON attempt_messages (attempt_id, client_msg_id);
