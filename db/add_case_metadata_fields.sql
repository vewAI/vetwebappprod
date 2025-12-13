-- Migration: Add metadata fields to cases table for scaling
-- Adds versioning, tags, difficulty, and publication status

ALTER TABLE public.cases
ADD COLUMN IF NOT EXISTS version integer DEFAULT 1,
ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS difficulty text DEFAULT 'intermediate',
ADD COLUMN IF NOT EXISTS is_published boolean DEFAULT false;

-- Add index for faster filtering
CREATE INDEX IF NOT EXISTS idx_cases_is_published ON public.cases (is_published);
CREATE INDEX IF NOT EXISTS idx_cases_tags ON public.cases USING GIN (tags);

-- Set existing cases to published so they don't disappear
UPDATE public.cases SET is_published = true;
