-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Create case_knowledge table
CREATE TABLE IF NOT EXISTS case_knowledge (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id text NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  content text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  embedding vector(1536), -- OpenAI Embedding dimension
  created_at timestamptz DEFAULT now()
);

-- Index for faster semantic search using ivfflat
-- Note: 'lists' parameter recommended to be rows / 1000 for up to 1M rows. 
-- Starting with 100 lists covers up to 100k rows decently.
CREATE INDEX IF NOT EXISTS idx_case_knowledge_embedding ON case_knowledge USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Enable RLS
ALTER TABLE case_knowledge ENABLE ROW LEVEL SECURITY;

-- Policies

-- Admins and Professors can insert/update/delete knowledge
CREATE POLICY "Admins and Professors can manage knowledge" ON case_knowledge
  FOR ALL USING (
    auth.uid() IN (
      SELECT user_id FROM profiles WHERE role IN ('admin', 'professor')
    )
  );

-- Authenticated users (students) need to read knowledge during chat
-- However, typically the embedding search happens server-side with service role or admin privileges
-- if we put the logic in an Edge Function or Next.js API route.
-- If the client needs to search directly (less secure for "concept reveal" control), we'd open this.
-- Based on the plan, the "Timepoint-Aware Retrieval" happens in the "Simulation Engine" (Chat Service).
-- If Chat Service runs server-side, we don't strictly need a SELECT policy for 'authenticated' if using Service Role.
-- But usually, our Next.js API uses the user's session.
-- So we should allow SELECT for authenticated users, but maybe we rely on the API filter.
-- Actually, the best practice is to allow Select for authenticated users, 
-- but ensuring the API only queries what it should.

CREATE POLICY "Authenticated users can read knowledge" ON case_knowledge
  FOR SELECT USING (
    auth.role() = 'authenticated'
  );

-- RPC function for semantic search
CREATE OR REPLACE FUNCTION match_case_knowledge (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  filter_case_id text
)
RETURNS TABLE (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    case_knowledge.id,
    case_knowledge.content,
    case_knowledge.metadata,
    1 - (case_knowledge.embedding <=> query_embedding) as similarity
  FROM case_knowledge
  WHERE case_knowledge.case_id = filter_case_id
  AND 1 - (case_knowledge.embedding <=> query_embedding) > match_threshold
  ORDER BY case_knowledge.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
