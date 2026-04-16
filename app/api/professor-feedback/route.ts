import { NextResponse } from "next/server";
import { requireUser } from "@/app/api/_lib/auth";

export async function GET(req: Request) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;
  const { adminSupabase, user, role } = auth;
  if (!adminSupabase) return NextResponse.json({ error: "Server configuration error" }, { status: 500 });

  try {
    const url = new URL(req.url);
    const studentId = url.searchParams.get("studentId");
    const caseId = url.searchParams.get("caseId");

    // Build the base query
    const buildQuery = (targetStudentId: string) => {
      let q = adminSupabase
        .from("professor_feedback")
        .select("*")
        .eq("student_id", targetStudentId);

      if (caseId) {
        q = q.eq("case_id", caseId);
      }

      return q.order("created_at", { ascending: false });
    };

    let targetStudentId: string;

    if (role === "professor") {
      if (!studentId) return NextResponse.json({ error: "studentId query param required" }, { status: 400 });
      targetStudentId = studentId;
    } else if (role === "student") {
      targetStudentId = user.id;
    } else if (role === "admin") {
      if (!studentId) return NextResponse.json({ error: "studentId required for admin" }, { status: 400 });
      targetStudentId = studentId;
    } else {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data, error } = await buildQuery(targetStudentId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Auto-mark as read for the current user (best-effort, non-blocking)
    const markRead = (async () => {
      try {
        const now = new Date().toISOString();
        let markQuery = adminSupabase
          .from("professor_feedback")
          .update({ read_at: now })
          .eq("student_id", targetStudentId)
          .is("read_at", null);

        if (caseId) {
          markQuery = markQuery.eq("case_id", caseId);
        }

        if (role === "student") {
          // Student reads professor messages
          await markQuery.eq("sender_role", "professor");
        } else if (role === "professor") {
          // Professor reads student messages
          await markQuery.eq("sender_role", "student");
        }
      } catch {
        // Non-blocking — ignore mark-read failures
      }
    })();

    await markRead;

    return NextResponse.json({ feedback: data || [] });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg || "Unknown error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;
  const { adminSupabase, user, role } = auth;
  if (!adminSupabase) return NextResponse.json({ error: "Server configuration error" }, { status: 500 });

  try {
    const body = await req.json();
    const { professorId, studentId, message, caseId, senderRole: explicitSenderRole } = body;
    if (!professorId || !studentId || !message) {
      return NextResponse.json({ error: "professorId, studentId and message are required" }, { status: 400 });
    }

    // Determine sender_role automatically
    const senderRole = explicitSenderRole || (role === "professor" ? "professor" : "student");

    // Validate ownership
    if (role === "professor") {
      if (professorId !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    if (role === "student") {
      if (studentId !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const payload: Record<string, unknown> = {
      professor_id: professorId,
      student_id: studentId,
      message,
      sender_role: senderRole,
      case_id: caseId || null,
      read_at: null,
    };

    const { data, error } = await adminSupabase.from("professor_feedback").insert(payload).select().single();
    if (error) return NextResponse.json({ error: error.message || String(error) }, { status: 500 });
    return NextResponse.json({ success: true, feedback: data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg || "Unknown error" }, { status: 500 });
  }
}
