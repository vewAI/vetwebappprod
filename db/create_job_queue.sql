-- Create simple job queue for background processing of heavy tasks like paper ingestion

CREATE TABLE IF NOT EXISTS public.job_queue (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  queue_name text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending', -- pending | in_progress | done | failed
  attempt_count int NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index to fetch pending jobs
CREATE INDEX IF NOT EXISTS idx_job_queue_status_created_at ON public.job_queue (status, created_at);
