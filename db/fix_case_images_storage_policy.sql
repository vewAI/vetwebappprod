-- Ensure the bucket exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('case-images', 'case-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated uploads
DROP POLICY IF EXISTS "Allow authenticated uploads to case-images" ON storage.objects;
CREATE POLICY "Allow authenticated uploads to case-images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'case-images');

-- Allow authenticated updates
DROP POLICY IF EXISTS "Allow authenticated updates to case-images" ON storage.objects;
CREATE POLICY "Allow authenticated updates to case-images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'case-images');

-- Allow authenticated deletes
DROP POLICY IF EXISTS "Allow authenticated deletes to case-images" ON storage.objects;
CREATE POLICY "Allow authenticated deletes to case-images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'case-images');

-- Allow public read
DROP POLICY IF EXISTS "Allow public read of case-images" ON storage.objects;
CREATE POLICY "Allow public read of case-images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'case-images');
