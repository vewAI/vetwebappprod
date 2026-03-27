-- Create nurse_specializations table for species-specific nurse data
CREATE TABLE IF NOT EXISTS public.nurse_specializations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  species_key text NOT NULL UNIQUE,
  display_name text NOT NULL,
  image_url text,
  sex text,
  voice_id text,
  behavior_prompt text NOT NULL,
  skills jsonb NOT NULL DEFAULT '[]',
  lab_reference_ranges jsonb DEFAULT '{}',
  vital_reference_ranges jsonb DEFAULT '{}',
  common_pathologies jsonb DEFAULT '[]',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index on species_key for fast lookup
CREATE INDEX IF NOT EXISTS idx_nurse_specializations_species ON public.nurse_specializations (species_key);
