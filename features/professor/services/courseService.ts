import { supabase } from "@/lib/supabase";
import type {
  Course,
  CourseStudent,
  CourseCaseAssignment,
  CourseStats,
  StudentStat,
  CaseStat,
} from "../models/courseTypes";

// ── Course CRUD ────────────────────────────────────────────────

export async function createCourse(
  professorId: string,
  data: { name: string; description?: string }
): Promise<Course> {
  const { data: row, error } = await supabase
    .from("courses")
    .insert({
      professor_id: professorId,
      name: data.name,
      description: data.description ?? "",
    })
    .select()
    .single();
  if (error) throw error;
  return mapCourse(row);
}

export async function getProfessorCourses(professorId: string): Promise<Course[]> {
  const { data, error } = await supabase
    .from("courses")
    .select("*, course_students(count)")
    .eq("professor_id", professorId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapCourse);
}

export async function getCourseById(courseId: string): Promise<Course | null> {
  const { data, error } = await supabase
    .from("courses")
    .select("*, course_students(count)")
    .eq("id", courseId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapCourse(data) : null;
}

export async function updateCourse(
  courseId: string,
  data: { name?: string; description?: string }
): Promise<Course> {
  const { data: row, error } = await supabase
    .from("courses")
    .update(data)
    .eq("id", courseId)
    .select()
    .single();
  if (error) throw error;
  return mapCourse(row);
}

export async function deleteCourse(courseId: string): Promise<void> {
  const { error } = await supabase.from("courses").delete().eq("id", courseId);
  if (error) throw error;
}

// ── Course Students ────────────────────────────────────────────

export async function getCourseStudents(courseId: string): Promise<CourseStudent[]> {
  const { data, error } = await supabase
    .from("course_students")
    .select("*, profiles!course_students_student_id_fkey(user_id, full_name, email, avatar_url)")
    .eq("course_id", courseId)
    .order("added_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapCourseStudent);
}

export async function addStudentsToCourse(
  courseId: string,
  studentIds: string[]
): Promise<void> {
  const rows = studentIds.map((sid) => ({
    course_id: courseId,
    student_id: sid,
  }));
  const { error } = await supabase.from("course_students").insert(rows);
  if (error) throw error;
}

export async function removeStudentFromCourse(
  courseId: string,
  studentId: string
): Promise<void> {
  const { error } = await supabase
    .from("course_students")
    .delete()
    .eq("course_id", courseId)
    .eq("student_id", studentId);
  if (error) throw error;
}

// ── Course Case Assignments ────────────────────────────────────

export async function getCasesForCourse(courseId: string): Promise<CourseCaseAssignment[]> {
  const { data, error } = await supabase
    .from("course_case_assignments")
    .select("*, cases(id, title, difficulty, species)")
    .eq("course_id", courseId)
    .order("assigned_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapCourseCaseAssignment);
}

export async function assignCaseToCourse(
  courseId: string,
  caseId: string,
  assignedBy: string
): Promise<void> {
  const { error } = await supabase
    .from("course_case_assignments")
    .insert({
      course_id: courseId,
      case_id: caseId,
      assigned_by: assignedBy,
    });
  if (error) throw error;
}

// ── Course Stats (aggregation) ─────────────────────────────────

export async function getCourseStats(
  courseId: string
): Promise<CourseStats> {
  // 1. Get all students in the course
  const students = await getCourseStudents(courseId);
  const studentIds = students.map((s) => s.studentId);

  if (studentIds.length === 0) {
    return {
      totalStudents: 0,
      studentsWithCompletedAttempt: 0,
      totalAttempts: 0,
      completedAttempts: 0,
      completionRate: 0,
      avgTimeSeconds: 0,
      perStudent: [],
      perCase: [],
    };
  }

  // 2. Get all assigned cases for this course
  const assignedCases = await getCasesForCourse(courseId);

  // 3. Get all attempts for these students
  const { data: attempts, error: attemptsError } = await supabase
    .from("attempts")
    .select("user_id, case_id, completion_status, time_spent_seconds, created_at")
    .in("user_id", studentIds);
  if (attemptsError) throw attemptsError;

  const allAttempts = attempts ?? [];
  const completed = allAttempts.filter((a) => a.completion_status === "completed");

  // Per-student stats
  const perStudent: StudentStat[] = students.map((cs) => {
    const studentAttempts = allAttempts.filter((a) => a.user_id === cs.studentId);
    const studentCompleted = studentAttempts.filter(
      (a) => a.completion_status === "completed"
    );
    const totalTime = studentCompleted.reduce(
      (sum, a) => sum + (a.time_spent_seconds ?? 0),
      0
    );
    const lastActivity =
      studentAttempts.length > 0
        ? studentAttempts.sort(
            (a, b) =>
              new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )[0].created_at
        : null;

    return {
      studentId: cs.studentId,
      fullName: cs.student?.fullName ?? "Unknown",
      email: cs.student?.email ?? "",
      completedAttempts: studentCompleted.length,
      totalAttempts: studentAttempts.length,
      avgTimeSeconds:
        studentCompleted.length > 0
          ? Math.round(totalTime / studentCompleted.length)
          : 0,
      lastActivityAt: lastActivity,
    };
  });

  // Per-case stats
  const perCase: CaseStat[] = assignedCases.map((ca) => {
    const caseAttempts = allAttempts.filter((a) => a.case_id === ca.caseId);
    const caseCompleted = caseAttempts.filter(
      (a) => a.completion_status === "completed"
    );
    const uniqueStudentsCompleted = new Set(
      caseCompleted.map((a) => a.user_id)
    ).size;

    return {
      caseId: ca.caseId,
      caseTitle: ca.case?.title ?? ca.caseId,
      studentsCompleted: uniqueStudentsCompleted,
      studentsAssigned: studentIds.length,
    };
  });

  const totalTimeAll = completed.reduce(
    (sum, a) => sum + (a.time_spent_seconds ?? 0),
    0
  );
  const studentsWithCompleted = new Set(completed.map((a) => a.user_id)).size;

  return {
    totalStudents: studentIds.length,
    studentsWithCompletedAttempt: studentsWithCompleted,
    totalAttempts: allAttempts.length,
    completedAttempts: completed.length,
    completionRate:
      studentIds.length > 0
        ? Math.round((studentsWithCompleted / studentIds.length) * 100)
        : 0,
    avgTimeSeconds:
      completed.length > 0 ? Math.round(totalTimeAll / completed.length) : 0,
    perStudent,
    perCase,
  };
}

// ── Mappers ────────────────────────────────────────────────────

function mapCourse(row: Record<string, unknown>): Course {
  const studentCountArr = row.course_students as
    | { count: number }[]
    | undefined;
  return {
    id: row.id as string,
    professorId: row.professor_id as string,
    name: row.name as string,
    description: (row.description as string) ?? "",
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    studentCount: studentCountArr?.[0]?.count ?? 0,
  };
}

function mapCourseStudent(row: Record<string, unknown>): CourseStudent {
  const profile = row.profiles as Record<string, unknown> | undefined;
  return {
    id: row.id as string,
    courseId: row.course_id as string,
    studentId: row.student_id as string,
    addedAt: row.added_at as string,
    student: profile
      ? {
          id: (profile.user_id as string) ?? "",
          fullName: (profile.full_name as string) ?? "Unknown",
          email: (profile.email as string) ?? "",
          avatarUrl: (profile.avatar_url as string) ?? undefined,
        }
      : undefined,
  };
}

function mapCourseCaseAssignment(
  row: Record<string, unknown>
): CourseCaseAssignment {
  const caseData = row.cases as Record<string, unknown> | undefined;
  return {
    id: row.id as string,
    courseId: row.course_id as string,
    caseId: row.case_id as string,
    assignedBy: row.assigned_by as string,
    assignedAt: row.assigned_at as string,
    case: caseData
      ? {
          id: (caseData.id as string) ?? "",
          title: (caseData.title as string) ?? "",
          difficulty: (caseData.difficulty as string) ?? "",
          species: (caseData.species as string) ?? "",
        }
      : undefined,
  };
}
