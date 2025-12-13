-- Enable RLS on case_personas if not already
ALTER TABLE public.case_personas ENABLE ROW LEVEL SECURITY;

-- Policy for case_personas
DROP POLICY IF EXISTS "Enable all access for authenticated users on case_personas" ON public.case_personas;
CREATE POLICY "Enable all access for authenticated users on case_personas"
ON public.case_personas
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Enable RLS on global_personas if not already
ALTER TABLE public.global_personas ENABLE ROW LEVEL SECURITY;

-- Policy for global_personas
DROP POLICY IF EXISTS "Enable all access for authenticated users on global_personas" ON public.global_personas;
CREATE POLICY "Enable all access for authenticated users on global_personas"
ON public.global_personas
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Storage policies for persona-images
INSERT INTO storage.buckets (id, name, public)
VALUES ('persona-images', 'persona-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Allow authenticated uploads to persona-images" ON storage.objects;
CREATE POLICY "Allow authenticated uploads to persona-images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'persona-images');

DROP POLICY IF EXISTS "Allow authenticated updates to persona-images" ON storage.objects;
CREATE POLICY "Allow authenticated updates to persona-images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'persona-images');

DROP POLICY IF EXISTS "Allow public read of persona-images" ON storage.objects;
CREATE POLICY "Allow public read of persona-images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'persona-images');
