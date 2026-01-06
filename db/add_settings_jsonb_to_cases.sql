-- Safe migration: add a `settings jsonb` column to `cases` if it does not exist
-- and ensure every row has at least an empty object. Run this on the deployed DB as the
-- database migration/DB admin (this file is intentionally not auto-executed).

BEGIN;

ALTER TABLE IF EXISTS cases
  ADD COLUMN IF NOT EXISTS settings jsonb DEFAULT '{}'::jsonb;

-- Ensure every row has the stageActivation key present to avoid runtime checks
UPDATE cases
SET settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object('stageActivation', COALESCE(settings->'stageActivation', '{}'::jsonb))
WHERE (settings IS NULL) OR (settings->'stageActivation' IS NULL);

COMMIT;
