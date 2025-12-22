-- Add feedback_read_at column to attempts to track when student last viewed professor feedback

ALTER TABLE public.attempts
  ADD COLUMN IF NOT EXISTS feedback_read_at timestamptz;

-- Note: run this migration in your own environment (psql / migration tool).
