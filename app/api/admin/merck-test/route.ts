import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/app/api/_lib/auth";
import { searchMerckManual } from "@/features/external-resources/services/merckService";

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if ("error" in auth) return auth.error;

  try {
    const body = await request.json().catch(() => ({} as any));
    const q = (body?.query as string) || "mastitis in cattle";
    const result = await searchMerckManual(q);
    return NextResponse.json({ ok: true, query: q, result });
  } catch (err) {
    console.error("Merck test failed", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
