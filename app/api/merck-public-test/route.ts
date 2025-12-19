import { NextRequest, NextResponse } from "next/server";
import { searchMerckManual } from "@/features/external-resources/services/merckService";

// WARNING: This endpoint is intentionally gated behind the
// ENABLE_MERCK_PUBLIC_TEST environment variable. Do NOT enable in
// production unless you understand the risks. When enabled, it allows
// unauthenticated calls to run a Merck Manual search using server-side
// credentials stored in environment variables.

export async function POST(req: NextRequest) {
  if (process.env.ENABLE_MERCK_PUBLIC_TEST !== "true") {
    return NextResponse.json({ ok: false, error: "Public Merck test disabled" }, { status: 403 });
  }

  try {
    const body = await req.json().catch(() => ({} as any));
    const q = (body?.query as string) || "mastitis in cattle";
    const result = await searchMerckManual(q);
    return NextResponse.json({ ok: true, query: q, result });
  } catch (err) {
    console.error("Public Merck test failed", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
