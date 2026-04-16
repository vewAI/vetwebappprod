-- Add archived column to courses for soft-delete / archiving
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;
