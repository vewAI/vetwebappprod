-- Add findings_release_strategy column to cases table
ALTER TABLE cases 
ADD COLUMN IF NOT EXISTS findings_release_strategy text DEFAULT 'immediate';

COMMENT ON COLUMN cases.findings_release_strategy IS 'Controls how diagnostic findings are revealed: "immediate" (all at once) or "on_demand" (ask for specific values).';
