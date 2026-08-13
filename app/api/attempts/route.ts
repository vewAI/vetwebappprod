import { NextResponse } from "next/server";
import { requireUser } from "@/app/api/_lib/auth";
import { authorizeAttemptAccess } from "@/app/api/_lib/authorization";

// Delete an attempt by id (query param ?id=...)
export async function DELETE(req: Request) {
  const auth = await requireUser(req);
  if ("error" in auth) {
    return auth.error;
  }
  const { supabase } = auth;
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return NextResponse.json(
        { error: "id query param is required" },
        { status: 400 }
      );
    }

    const adminClient = auth.adminSupabase ?? supabase;
    const access = await authorizeAttemptAccess(adminClient, id, auth.user.id, auth.role);
    if (access.error) {
      return NextResponse.json({ error: "Failed to verify permissions" }, { status: 500 });
    }
    if (access.notFound) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
    }
    if (!access.allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { error } = await adminClient.from("attempts").delete().eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: msg || "Unknown error" },
      { status: 500 }
    );
  }
}
