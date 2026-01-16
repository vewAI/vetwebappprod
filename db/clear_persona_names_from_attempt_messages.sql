-- Clear old persona names from stored attempt_messages
-- This replaces specific names with generic role labels in the displayRole field

-- The content column is TEXT (JSON string), not JSONB, so we need to parse it

-- Preview what will be changed (run this first to verify)
-- SELECT id, attempt_id, 
--   (content::jsonb)->>'displayRole' as old_displayRole
-- FROM attempt_messages
-- WHERE (content::jsonb)->>'displayRole' ~ '^[A-Z][a-z]+ [A-Z][a-z]+$'
-- LIMIT 20;

-- Update displayRole field in attempt_messages to generic roles
-- Matches patterns like "Martin Walsh", "Amanda Burns", "John Smith"
UPDATE attempt_messages
SET content = (
  jsonb_set(
    content::jsonb,
    '{displayRole}',
    '"Owner"'::jsonb
  )
)::text
WHERE (content::jsonb)->>'displayRole' ~ '^[A-Z][a-z]+ [A-Z][a-z]+$'
  AND (content::jsonb)->>'role' = 'assistant';

-- Report how many rows were updated
-- SELECT COUNT(*) as messages_updated 
-- FROM attempt_messages 
-- WHERE (content::jsonb)->>'displayRole' = 'Owner' AND (content::jsonb)->>'role' = 'assistant';
