import { NextResponse } from "next/server";
import { requireUser } from "@/app/api/_lib/auth";

import { normalizeCaseMedia, CaseMediaItem } from "@/features/cases/models/caseMedia";

export async function POST(req: Request) {
  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;

  const { role, adminSupabase, supabase } = auth;
  if (!role || (role !== "professor" && role !== "admin")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { caseId, media } = body as { caseId?: string; media?: CaseMediaItem };
  if (!caseId || !media) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  const db = adminSupabase ?? supabase;

  try {
    const { data: existing, error: fetchErr } = await db.from("cases").select("id, media").eq("id", caseId).maybeSingle();
    if (fetchErr) {
      console.error("Failed to fetch case for media append", fetchErr);
      return NextResponse.json({ error: "db_fetch_failed" }, { status: 500 });
    }

    const currentMedia = normalizeCaseMedia((existing as any)?.media ?? []);
    // ensure id
    const newItem = { ...media } as CaseMediaItem;
    if (!newItem.id) newItem.id = `${Date.now()}-${Math.random()}`;

    const updated = [...currentMedia, newItem];

    const { data: updatedRow, error: updateErr } = await db.from("cases").update({ media: updated }).eq("id", caseId).select().maybeSingle();
    if (updateErr) {
      console.error("Failed to update case media", updateErr);
      return NextResponse.json({ error: "db_update_failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: updatedRow });
  } catch (err) {
    console.error("Unexpected error in cases/media", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
