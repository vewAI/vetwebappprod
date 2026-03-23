import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/app/api/_lib/auth";

function roleForbidden(role: string | null): boolean {
  return role !== "admin" && role !== "professor";
}

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if ("error" in auth) return auth.error;
  if (roleForbidden(auth.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await request.json()) as {
      caseId?: string;
      approvedValues?: Record<string, string>;
      format?: string;
    };

    const format = String(body?.format ?? "txt").toLowerCase();
    if (format !== "txt") {
      return NextResponse.json({ error: "Only txt export is supported." }, { status: 400 });
    }

    const caseId = String(body?.caseId ?? "new-case").trim() || "new-case";
    const approvedValues = body?.approvedValues && typeof body.approvedValues === "object" ? body.approvedValues : {};

    const lines: string[] = [];
    lines.push(`Case ID: ${caseId}`);
    lines.push("");

    for (const [key, value] of Object.entries(approvedValues)) {
      lines.push(`${key}:`);
      lines.push(String(value ?? ""));
      lines.push("");
    }

    const content = lines.join("\n");
    const base64 = Buffer.from(content, "utf-8").toString("base64");

    return NextResponse.json({
      fileName: `${caseId}.txt`,
      mimeType: "text/plain; charset=utf-8",
      contentBase64: base64,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
