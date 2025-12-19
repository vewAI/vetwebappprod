-- Create table to store professor feedback messages for students
CREATE TABLE IF NOT EXISTS professor_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professor_id uuid NOT NULL,
  student_id uuid NOT NULL,
  message text NOT NULL,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_professor_feedback_student ON professor_feedback(student_id);
CREATE INDEX IF NOT EXISTS idx_professor_feedback_professor ON professor_feedback(professor_id);
