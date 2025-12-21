import { NextResponse } from "next/server";
import PDFDocument from 'pdfkit';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { caseId, feedbackHtml, messages } = body as { caseId?: string; feedbackHtml?: string; messages?: Array<any> };

    // Create PDF document in memory
    const doc = new PDFDocument({ autoFirstPage: true, margin: 50 });
    const chunks: Uint8Array[] = [];
    doc.on('data', (chunk) => chunks.push(Buffer.from(chunk)));

    // Simple header
    doc.fontSize(18).text(`Feedback Report${caseId ? ` — Case ${caseId}` : ''}`, { align: 'left' });
    doc.moveDown();

    // Insert feedback (strip HTML tags for simplicity)
    const stripHtml = (html?: string) => {
      if (!html) return '';
      return String(html).replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ');
    };

    doc.fontSize(12).text('Instructor Feedback:', { underline: true });
    doc.moveDown(0.3);
    doc.fontSize(10).text(stripHtml(feedbackHtml), { align: 'left' });
    doc.addPage();

    doc.fontSize(12).text('Conversation Transcript:', { underline: true });
    doc.moveDown(0.3);
    if (Array.isArray(messages) && messages.length > 0) {
      for (const m of messages) {
        const time = m.timestamp ? new Date(m.timestamp).toLocaleString() : '';
        const role = m.displayRole || m.role || 'user';
        const content = String(m.content || '');
        doc.fontSize(10).fillColor('black').text(`${time} — ${role}:`, { continued: true }).fillColor('gray').text(` ${content}`);
        doc.moveDown(0.2);
      }
    } else {
      doc.fontSize(10).text('No messages available');
    }

    doc.end();

    const pdfBuffer = Buffer.concat(chunks);
    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="feedback-${caseId || 'report'}.pdf"`,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: 'export_failed', message }, { status: 500 });
  }
}
