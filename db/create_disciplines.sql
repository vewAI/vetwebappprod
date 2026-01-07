-- Create disciplines table to avoid 404 errors in UI
-- This table stores high-level categories/disciplines for cases

CREATE TABLE IF NOT EXISTS public.disciplines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.disciplines ENABLE ROW LEVEL SECURITY;

-- Allow public read access
DROP POLICY IF EXISTS "Allow public read access" ON public.disciplines;
CREATE POLICY "Allow public read access" ON public.disciplines FOR SELECT USING (true);

-- Insert default disciplines if empty (based on known categories)
INSERT INTO public.disciplines (name)
SELECT unnest(ARRAY[
  'Equine',
  'Small Animal Internal Medicine', 
  'Small Animal Surgery',
  'Bovine',
  'Exotic'
])
ON CONFLICT (name) DO NOTHING;
