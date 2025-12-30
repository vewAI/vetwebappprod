-- Migration: Add owner_persona_id and nurse_persona_id to cases table
-- These columns allow pinning specific personas to a case avatar selector.

ALTER TABLE public.cases
ADD COLUMN IF NOT EXISTS owner_persona_id TEXT,
ADD COLUMN IF NOT EXISTS nurse_persona_id TEXT,
ADD COLUMN IF NOT EXISTS estimated_time INTEGER;

COMMENT ON COLUMN public.cases.owner_persona_id IS 'ID or role_key of the specific global persona for the owner avatar.';
COMMENT ON COLUMN public.cases.nurse_persona_id IS 'ID or role_key of the specific global persona for the nurse avatar.';
COMMENT ON COLUMN public.cases.estimated_time IS 'Approximate duration in minutes for the case.';
