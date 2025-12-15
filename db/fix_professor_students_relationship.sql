-- Fix relationship between professor_students and profiles
-- This allows Supabase to join professor_students with profiles via student_id -> user_id

-- 1. Ensure profiles.user_id is unique (required for it to be a foreign key target)
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'profiles_user_id_key'
    ) THEN
        ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);
    END IF;
END $$;

-- 2. Add foreign key from professor_students.student_id to profiles.user_id
-- We use a specific name so we can reference it in the query if needed, 
-- but PostgREST should pick it up automatically.
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_professor_students_profiles'
    ) THEN
        ALTER TABLE public.professor_students
        ADD CONSTRAINT fk_professor_students_profiles
        FOREIGN KEY (student_id)
        REFERENCES public.profiles(user_id)
        ON DELETE CASCADE;
    END IF;
END $$;
