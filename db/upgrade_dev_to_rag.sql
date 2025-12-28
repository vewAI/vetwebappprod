-- Upgrade Script: Dev Environment -> RAG Features
-- Run this AFTER you have restored your Production schema/data to the Dev project.

BEGIN;

-- 1. Enable pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- 2. Fix Broken Permissions on case_timepoints
-- The original policy incorrectly compared User ID (auth.uid) with Profile Row ID (id).
-- We update it to compare auth.uid with profiles.user_id.

DROP POLICY IF EXISTS "Admins and Professors can view all timepoints" ON case_timepoints;
DROP POLICY IF EXISTS "Admins and Professors can insert timepoints" ON case_timepoints;
DROP POLICY IF EXISTS "Admins and Professors can update timepoints" ON case_timepoints;
DROP POLICY IF EXISTS "Admins and Professors can delete timepoints" ON case_timepoints;

CREATE POLICY "Admins and Professors can view all timepoints" ON case_timepoints
  FOR SELECT USING (
    auth.uid() IN (
      SELECT user_id FROM profiles WHERE role IN ('admin', 'professor')
    )
  );

CREATE POLICY "Admins and Professors can insert timepoints" ON case_timepoints
  FOR INSERT WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM profiles WHERE role IN ('admin', 'professor')
    )
  );

CREATE POLICY "Admins and Professors can update timepoints" ON case_timepoints
  FOR UPDATE USING (
    auth.uid() IN (
      SELECT user_id FROM profiles WHERE role IN ('admin', 'professor')
    )
  );

CREATE POLICY "Admins and Professors can delete timepoints" ON case_timepoints
  FOR DELETE USING (
    auth.uid() IN (
      SELECT user_id FROM profiles WHERE role IN ('admin', 'professor')
    )
  );

-- 3. Create Knowledge Base Table
-- Uses TEXT for case_id to match the existing cases table schema.

CREATE TABLE IF NOT EXISTS case_knowledge (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  case_id text NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  content text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  embedding vector(1536), -- OpenAI Embedding dimension
  created_at timestamptz DEFAULT now()
);

-- Index for faster semantic search using ivfflat
CREATE INDEX IF NOT EXISTS idx_case_knowledge_embedding ON case_knowledge USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Enable RLS
ALTER TABLE case_knowledge ENABLE ROW LEVEL SECURITY;

-- Policies for Knowledge Base
CREATE POLICY "Admins and Professors can manage knowledge" ON case_knowledge
  FOR ALL USING (
    auth.uid() IN (
      SELECT user_id FROM profiles WHERE role IN ('admin', 'professor')
    )
  );

CREATE POLICY "Authenticated users can read knowledge" ON case_knowledge
  FOR SELECT USING (
    auth.role() = 'authenticated'
  );

-- 4. Create Semantic Search Function
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

-- 5. Set up Storage Bucket and Policies for Case Materials
-- Ensure the bucket exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('case-media', 'case-media', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated uploads (Professors/Admins)
DROP POLICY IF EXISTS "Allow authenticated uploads to case-media" ON storage.objects;
CREATE POLICY "Allow authenticated uploads to case-media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'case-media');

-- Allow authenticated updates
DROP POLICY IF EXISTS "Allow authenticated updates to case-media" ON storage.objects;
CREATE POLICY "Allow authenticated updates to case-media"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'case-media');

-- Allow authenticated deletes
DROP POLICY IF EXISTS "Allow authenticated deletes to case-media" ON storage.objects;
CREATE POLICY "Allow authenticated deletes to case-media"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'case-media');

-- Allow public read (for simulation and professor review)
DROP POLICY IF EXISTS "Allow public read of case-media" ON storage.objects;
CREATE POLICY "Allow public read of case-media"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'case-media');

COMMIT;
