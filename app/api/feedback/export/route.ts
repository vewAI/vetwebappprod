import { NextRequest, NextResponse } from "next/server";
import PDFDocument from "pdfkit";

export async function POST(req: NextRequest) {
  try {
    const { caseId, feedbackHtml, messages } = await req.json();

    // Create a PDF document
    const doc = new PDFDocument({ margin: 50 });
    const chunks: Uint8Array[] = [];

    doc.on("data", (chunk: Uint8Array) => chunks.push(chunk));

    return new Promise((resolve) => {
      doc.on("end", () => {
        const result = Buffer.concat(chunks);
        resolve(
          new NextResponse(result, {
            headers: {
              "Content-Type": "application/pdf",
              "Content-Disposition": `attachment; filename="feedback-${caseId}.pdf"`,
            },
          })
        );
      });

      // --- PDF Content Generation ---
      doc.fontSize(22).text(`Case Feedback Report`, { align: "center" });
      doc.moveDown(0.2);
      doc.fontSize(14).text(`Case ID: ${caseId}`, { align: "center" });
      doc.fontSize(10).text(`Generated: ${new Date().toLocaleString()}`, { align: "center" });
      doc.moveDown(2);

      // Simple HTML stripping and formatting for basic PDF layout
      // We handle headers, lists, and basic spacing
      let cleanText = feedbackHtml
        .replace(/<h1[^>]*>/gi, "\n\n# ")
        .replace(/<h2[^>]*>/gi, "\n\n## ")
        .replace(/<h3[^>]*>/gi, "\n\n### ")
        .replace(/<\/h[1-6]>/gi, "\n")
        .replace(/<p[^>]*>/gi, "\n")
        .replace(/<\/p>/gi, "\n")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<li>/gi, "\n• ")
        .replace(/<\/li>/gi, "")
        .replace(/<ul[^>]*>/gi, "\n")
        .replace(/<\/ul>/gi, "\n")
        .replace(/<ol[^>]*>/gi, "\n")
        .replace(/<\/ol>/gi, "\n")
        .replace(/<strong[^>]*>|<b>/gi, "")
        .replace(/<\/strong>|<\/b>/gi, "")
        .replace(/<[^>]+>/g, "") // Strip any remaining tags
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/\n\s*\n\s*\n/g, "\n\n") // Collapse triple newlines
        .trim();

      // Split by header markers to apply some basic styling if we wanted, 
      // but for now, simple text block is safer with pdfkit.
      doc.fontSize(11).lineGap(2).text(cleanText, {
        align: "left",
        paragraphGap: 10,
      });

      // Transcript Section
      if (Array.isArray(messages) && messages.length > 0) {
        doc.addPage();
        doc.fontSize(18).text("Clinical Conversation Transcript", { underline: true });
        doc.moveDown(1);

        messages.forEach((m: any) => {
          const role = (m.displayRole || m.role || "unknown").toUpperCase();
          doc.fontSize(9).fillColor("#666666").text(`${role}:`, { continued: true });
          doc.fillColor("#000000").fontSize(10).text(` ${m.content || ""}`);
          doc.moveDown(0.5);
        });
      }

      doc.end();
    });
  } catch (error) {
    console.error("PDF Export error:", error);
    return NextResponse.json(
      { error: "pdf_generation_failed", details: String(error) },
      { status: 500 }
    );
  }
}
