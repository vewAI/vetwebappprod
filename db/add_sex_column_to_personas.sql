-- Add sex column to case_personas
ALTER TABLE public.case_personas
ADD COLUMN IF NOT EXISTS sex text CHECK (sex IN ('male', 'female', 'neutral'));

-- Add sex column to global_personas if it exists (for consistency)
ALTER TABLE public.global_personas
ADD COLUMN IF NOT EXISTS sex text CHECK (sex IN ('male', 'female', 'neutral'));
