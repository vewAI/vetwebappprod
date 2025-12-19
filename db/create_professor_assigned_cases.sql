-- Create table to track cases assigned by professors to students
CREATE TABLE IF NOT EXISTS professor_assigned_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professor_id uuid NOT NULL,
  student_id uuid NOT NULL,
  case_id uuid NOT NULL,
  assigned_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_professor_assigned_case ON professor_assigned_cases(professor_id, student_id, case_id);
CREATE INDEX IF NOT EXISTS idx_professor_assigned_cases_student ON professor_assigned_cases(student_id);
