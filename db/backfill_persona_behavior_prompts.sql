-- Backfill behavior_prompt values using existing persona metadata.
-- Copies the textual behavior prompt stored in metadata.behaviorPrompt when
-- behavior_prompt is missing or blank. Run once after deploying the new column.

UPDATE public.case_personas
SET behavior_prompt = metadata ->> 'behaviorPrompt'
WHERE (behavior_prompt IS NULL OR behavior_prompt = '')
  AND metadata ? 'behaviorPrompt';

-- Optional: mark updated rows with a manual timestamp for auditing.
-- UPDATE public.case_personas
-- SET updated_at = NOW()
-- WHERE (behavior_prompt IS NULL OR behavior_prompt = '')
--   AND metadata ? 'behaviorPrompt';
