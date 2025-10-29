-- Create a checkpoints table to store raw case submissions before augmentation
CREATE TABLE IF NOT EXISTS public.case_checkpoints (
  id BIGSERIAL PRIMARY KEY,
  case_id TEXT,
  payload JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Optional index for quick lookup by case_id
CREATE INDEX IF NOT EXISTS idx_case_checkpoints_case_id ON public.case_checkpoints(case_id);
