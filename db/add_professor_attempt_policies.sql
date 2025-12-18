-- Allow professors to view and update their students' attempts

CREATE POLICY "Professors can view their students' attempts"
ON public.attempts
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.professor_students
    WHERE professor_students.professor_id = auth.uid()
    AND professor_students.student_id = attempts.user_id
  )
);

CREATE POLICY "Professors can update their students' attempts"
ON public.attempts
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.professor_students
    WHERE professor_students.professor_id = auth.uid()
    AND professor_students.student_id = attempts.user_id
  )
);
