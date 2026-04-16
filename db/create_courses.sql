-- Migration: Add courses (student groups) for professors
-- Creates: courses, course_students, course_case_assignments

-- 1. Create courses table
CREATE TABLE IF NOT EXISTS public.courses (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    professor_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name text NOT NULL,
    description text DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Create course_students table
CREATE TABLE IF NOT EXISTS public.course_students (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    added_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(course_id, student_id)
);

-- 3. Create course_case_assignments table
CREATE TABLE IF NOT EXISTS public.course_case_assignments (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
    case_id text NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
    assigned_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    assigned_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(course_id, case_id)
);

-- 4. Enable RLS
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_case_assignments ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies

-- courses: Professors manage their own courses
DROP POLICY IF EXISTS "Professors can manage their own courses" ON public.courses;
CREATE POLICY "Professors can manage their own courses"
    ON public.courses
    FOR ALL
    TO authenticated
    USING (auth.uid() = professor_id)
    WITH CHECK (auth.uid() = professor_id);

-- courses: Students can see courses they belong to
DROP POLICY IF EXISTS "Students can see their courses" ON public.courses;
CREATE POLICY "Students can see their courses"
    ON public.courses
    FOR SELECT
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.course_students
        WHERE course_students.course_id = courses.id
        AND course_students.student_id = auth.uid()
    ));

-- course_students: Professors manage enrollment in their courses
DROP POLICY IF EXISTS "Professors manage course enrollment" ON public.course_students;
CREATE POLICY "Professors manage course enrollment"
    ON public.course_students
    FOR ALL
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.courses
        WHERE courses.id = course_students.course_id
        AND courses.professor_id = auth.uid()
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.courses
        WHERE courses.id = course_students.course_id
        AND courses.professor_id = auth.uid()
    ));

-- course_students: Students can see their own enrollments
DROP POLICY IF EXISTS "Students see own enrollments" ON public.course_students;
CREATE POLICY "Students see own enrollments"
    ON public.course_students
    FOR SELECT
    TO authenticated
    USING (auth.uid() = student_id);

-- course_case_assignments: Professors manage case assignments in their courses
DROP POLICY IF EXISTS "Professors manage course case assignments" ON public.course_case_assignments;
CREATE POLICY "Professors manage course case assignments"
    ON public.course_case_assignments
    FOR ALL
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.courses
        WHERE courses.id = course_case_assignments.course_id
        AND courses.professor_id = auth.uid()
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.courses
        WHERE courses.id = course_case_assignments.course_id
        AND courses.professor_id = auth.uid()
    ));

-- course_case_assignments: Students can see assignments for their courses
DROP POLICY IF EXISTS "Students see course assignments" ON public.course_case_assignments;
CREATE POLICY "Students see course assignments"
    ON public.course_case_assignments
    FOR SELECT
    TO authenticated
    USING (EXISTS (
        SELECT 1 FROM public.course_students
        WHERE course_students.course_id = course_case_assignments.course_id
        AND course_students.student_id = auth.uid()
    ));

-- 6. Triggers for updated_at
DROP TRIGGER IF EXISTS set_courses_updated_at ON public.courses;
CREATE TRIGGER set_courses_updated_at
BEFORE UPDATE ON public.courses
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at();

-- 7. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_courses_professor_id ON public.courses(professor_id);
CREATE INDEX IF NOT EXISTS idx_course_students_course_id ON public.course_students(course_id);
CREATE INDEX IF NOT EXISTS idx_course_students_student_id ON public.course_students(student_id);
CREATE INDEX IF NOT EXISTS idx_course_case_assignments_course_id ON public.course_case_assignments(course_id);
