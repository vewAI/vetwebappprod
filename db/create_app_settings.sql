-- Create app_settings table to store app-wide JSON config
CREATE TABLE IF NOT EXISTS app_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- Optional: seed default LLM provider config (safe to run multiple times)
INSERT INTO app_settings (key, value)
VALUES (
  'llm_provider_config',
  '{"defaultProvider":"openai","featureOverrides":{"embeddings":null},"fallbackLists":{}}'
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
