-- Delete all attempts and related data
-- WARNING: This will permanently delete all student attempts!

-- First delete attempt_messages (has FK to attempts)
DELETE FROM attempt_messages;

-- Then delete the attempts themselves
DELETE FROM attempts;

-- Optionally report what was deleted
-- SELECT 'Deleted all attempts and messages' as result;
