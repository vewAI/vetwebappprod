-- ==========================================================
-- REFINED STORAGE POLICIES FOR RAG
-- Addresses "new row violates row-level security policy"
-- ==========================================================

BEGIN;

-- 1. Ensure bucket exists and is public
INSERT INTO storage.buckets (id, name, public)
VALUES ('case-media', 'case-media', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Delete existing conflicting policies for this bucket
DELETE FROM storage.policies 
WHERE bucket_id = 'case-media';

-- 3. Unified "ALL" policy for authenticated users 
-- This covers INSERT, UPDATE, SELECT, and DELETE
CREATE POLICY "authenticated_access_case_media" 
ON storage.objects FOR ALL 
TO authenticated 
USING (bucket_id = 'case-media')
WITH CHECK (bucket_id = 'case-media');

-- 4. Public access policy (for external AI text extraction and student viewing)
CREATE POLICY "public_view_case_media"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'case-media');

-- 5. Ensure case_knowledge is also fully accessible to professors/admins
DROP POLICY IF EXISTS "Admins and Professors can manage knowledge" ON public.case_knowledge;
CREATE POLICY "Admins and Professors can manage knowledge" ON public.case_knowledge
  FOR ALL USING (
    auth.uid() IN (
      SELECT user_id FROM profiles WHERE role IN ('admin', 'professor')
    )
  );

COMMIT;
