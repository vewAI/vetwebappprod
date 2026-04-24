import { NextResponse } from "next/server";
import { requireUser } from "@/app/api/_lib/auth";

export async function POST(req: Request) {
  const auth = await requireUser(req);
  if ("error" in auth) {
    return auth.error;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Gemini API key not configured" },
      { status: 500 }
    );
  }

  try {
    const body = await req.json();
    const caseId = body?.caseId;

    if (!caseId) {
      return NextResponse.json(
        { error: "caseId is required" },
        { status: 400 }
      );
    }

    // The Gemini Live WebSocket API uses the API key directly.
    // In production, consider using ephemeral tokens from a Token Server.
    return NextResponse.json({
      token: apiKey,
      model: "gemini-3.1-flash-live-preview",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
