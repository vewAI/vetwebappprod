-- F6.1: Learning objectives per case.
-- One objective per line (parsed by the feedback prompts). The AI feedback
-- evaluates the student against each objective and reports coverage.
--
-- Run with: Supabase SQL Editor, or psql -f db/add_learning_objectives.sql

ALTER TABLE cases ADD COLUMN IF NOT EXISTS learning_objectives text;
