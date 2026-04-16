-- Add case_id, sender_role, read_at to professor_feedback for case-specific messaging
-- case_id is text to match cases.id (which is text, not uuid)

ALTER TABLE public.professor_feedback
  ADD COLUMN IF NOT EXISTS case_id text,
  ADD COLUMN IF NOT EXISTS sender_role text NOT NULL DEFAULT 'professor',
  ADD COLUMN IF NOT EXISTS read_at timestamptz;

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_professor_feedback_case_id
  ON public.professor_feedback(case_id)
  WHERE case_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_professor_feedback_student_case
  ON public.professor_feedback(student_id, case_id)
  WHERE case_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_professor_feedback_student_unread
  ON public.professor_feedback(student_id, read_at)
  WHERE read_at IS NULL AND sender_role = 'professor';

CREATE INDEX IF NOT EXISTS idx_professor_feedback_professor_unread
  ON public.professor_feedback(professor_id, read_at)
  WHERE read_at IS NULL AND sender_role = 'student';
