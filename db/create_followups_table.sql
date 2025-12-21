-- Create followups table to support multi-day case follow-ups
CREATE TABLE IF NOT EXISTS followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid REFERENCES attempts(id) ON DELETE CASCADE,
  case_id text NOT NULL,
  followup_day integer NOT NULL DEFAULT 1,
  notes text,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);
