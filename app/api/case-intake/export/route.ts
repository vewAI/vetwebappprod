import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/app/api/_lib/auth";
import PDFDocument from "pdfkit";

function roleForbidden(role: string | null): boolean {
  return role !== "admin" && role !== "professor";
}

function simpleTranslate(key: string, lang?: string) {
  // Minimal i18n map for common labels; extend as needed
  const map: Record<string, Record<string, string>> = {
    "Case ID": { en: "Case ID", es: "ID del caso" },
  };
  const locale = (lang || "en").slice(0, 2);
  return (map[key] && (map[key][locale] ?? map[key].en)) || key;
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
      lang?: string;
    };

    const format = String(body?.format ?? "txt").toLowerCase();
    const lang = String(body?.lang ?? "en").toLowerCase();

    const caseId = String(body?.caseId ?? "new-case").trim() || "new-case";
    const approvedValues = body?.approvedValues && typeof body.approvedValues === "object" ? body.approvedValues : {};

    if (format === "txt") {
      const lines: string[] = [];
      lines.push(`${simpleTranslate("Case ID", lang)}: ${caseId}`);
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
    }

    if (format === "pdf") {
      // Generate a very simple PDF using pdfkit
      const doc = new PDFDocument({ margin: 40 });
      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
      // Register end listener BEFORE calling doc.end() to avoid race condition
      const pdfDone = new Promise<void>((res) => doc.once("end", res));

      const title = `${simpleTranslate("Case ID", lang)}: ${caseId}`;
      doc.fontSize(14).text(title, { underline: false });
      doc.moveDown();

      doc.fontSize(10);
      for (const [key, value] of Object.entries(approvedValues)) {
        doc.font("Helvetica-Bold").text(`${key}:`);
        doc.font("Helvetica").text(String(value ?? ""));
        doc.moveDown(0.5);
      }

      doc.end();

      await pdfDone;
      const pdfBuffer = Buffer.concat(chunks);
      const base64 = pdfBuffer.toString("base64");
      return NextResponse.json({ fileName: `${caseId}.pdf`, mimeType: "application/pdf", contentBase64: base64 });
    }

    return NextResponse.json({ error: "Unsupported format. Use 'txt' or 'pdf'." }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
