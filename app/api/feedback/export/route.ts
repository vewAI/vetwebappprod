import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ error: "pdf_export_unavailable" }, { status: 501 });
}
