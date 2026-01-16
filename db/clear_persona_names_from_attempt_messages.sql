-- Clear old persona names from stored attempt_messages
-- This replaces specific names with generic role labels in the displayRole field

-- Preview what will be changed (run this first to verify)
-- SELECT id, attempt_id, 
--   content->'displayRole' as old_displayRole,
--   CASE 
--     WHEN content->>'displayRole' ~ '^[A-Z][a-z]+ [A-Z][a-z]+$' THEN 'Owner'
--     ELSE content->>'displayRole'
--   END as new_displayRole
-- FROM attempt_messages
-- WHERE content->>'displayRole' ~ '^[A-Z][a-z]+ [A-Z][a-z]+$'
-- LIMIT 20;

-- Update displayRole field in attempt_messages to generic roles
-- Matches patterns like "Martin Walsh", "Amanda Burns", "John Smith"
UPDATE attempt_messages
SET content = jsonb_set(
  content,
  '{displayRole}',
  '"Owner"'::jsonb
)
WHERE content->>'displayRole' ~ '^[A-Z][a-z]+ [A-Z][a-z]+$'
  AND content->>'role' = 'assistant';

-- Also clear any that have nurse-like names but should be "Veterinary Nurse"
-- (If you have specific nurse names to target, add them here)

-- Report how many rows were updated
-- SELECT COUNT(*) as messages_updated 
-- FROM attempt_messages 
-- WHERE content->>'displayRole' = 'Owner' AND content->>'role' = 'assistant';
