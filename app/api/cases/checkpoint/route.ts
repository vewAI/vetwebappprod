import { NextResponse } from "next/server";

import { requireAdmin } from "@/app/api/_lib/auth";

export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if ("error" in auth) {
    return auth.error;
  }
  try {
    const { supabase } = auth;
    const body = await req.json();
    const caseId = body?.case_id ?? null;
    const payload = body?.payload ?? null;

    if (!payload) {
      return NextResponse.json(
        { error: "payload is required" },
        { status: 400 }
      );
    }

    const insert = {
      case_id: caseId,
      payload,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("case_checkpoints")
      .insert([insert])
      .select();
    if (error) {
      return NextResponse.json(
        { error: error.message, details: error },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: msg || "Unknown error" },
      { status: 500 }
    );
  }
}
