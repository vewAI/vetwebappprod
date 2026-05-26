-- Migration: case_sessions + attempts.session_id
-- Time-bounded, optionally code-gated sessions for grouping student attempts.

-- 1. case_sessions
CREATE TABLE IF NOT EXISTS public.case_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id text NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
    created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
    name text NOT NULL,
    friendly_name text NOT NULL,
    description text DEFAULT '',
    access_code text,
    start_at timestamptz NOT NULL,
    end_at timestamptz NOT NULL,
    attempt_limit_per_student integer,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT case_sessions_window CHECK (end_at > start_at)
);

CREATE INDEX IF NOT EXISTS idx_case_sessions_case_id ON public.case_sessions(case_id);
CREATE INDEX IF NOT EXISTS idx_case_sessions_created_by ON public.case_sessions(created_by);
CREATE INDEX IF NOT EXISTS idx_case_sessions_window ON public.case_sessions(start_at, end_at);

ALTER TABLE public.case_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Creator manages own case sessions" ON public.case_sessions;
CREATE POLICY "Creator manages own case sessions"
    ON public.case_sessions
    FOR ALL
    TO authenticated
    USING (auth.uid() = created_by)
    WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Authenticated read case sessions" ON public.case_sessions;
CREATE POLICY "Authenticated read case sessions"
    ON public.case_sessions
    FOR SELECT
    TO authenticated
    USING (true);

DROP TRIGGER IF EXISTS set_case_sessions_updated_at ON public.case_sessions;
CREATE TRIGGER set_case_sessions_updated_at
    BEFORE UPDATE ON public.case_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- 2. attempts.session_id
ALTER TABLE public.attempts
    ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES public.case_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_attempts_session_id ON public.attempts(session_id);
