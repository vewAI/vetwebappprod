import { NextResponse } from "next/server";
import OpenAI from "openai";

import { generateCaseImage } from "@/features/cases/services/caseImageService";
import { requireUser } from "@/app/api/_lib/auth";

const openaiKey = process.env.OPENAI_API_KEY;

const openai = openaiKey ? new OpenAI({ apiKey: openaiKey }) : null;

export async function PUT(req: Request) {
  const auth = await requireUser(req, { requireAdmin: true });
  if ("error" in auth) {
    return auth.error;
  }
  const { supabase } = auth;
  try {
    const body = await req.json();
    console.log("[api/cases/image] incoming body:", body);
    const id = body?.id;
    const image_url = body?.image_url ?? null;

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("cases")
      .update({ image_url })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[api/cases/image] supabase update error:", error, data);
      // Return the full error object in development to aid debugging.
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

export async function POST(req: Request) {
  if (!openai) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured for image generation." },
      { status: 500 }
    );
  }

  try {
    const auth = await requireUser(req, { requireAdmin: true });
    if ("error" in auth) {
      return auth.error;
    }
    const { supabase } = auth;
    const body = await req.json();
    const idRaw = body?.id;
    const forceRaw = body?.force;

    const id = typeof idRaw === "string" ? idRaw.trim() : "";
    const force = forceRaw === undefined ? true : Boolean(forceRaw);

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const { data: caseRow, error: caseError } = await supabase
      .from("cases")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (caseError) {
      return NextResponse.json(
        { error: caseError.message ?? "Failed to load case" },
        { status: 500 }
      );
    }

    if (!caseRow) {
      return NextResponse.json({ error: "Case not found" }, { status: 404 });
    }

    const imageUrl = await generateCaseImage(
      supabase,
      openai,
      caseRow as Record<string, unknown>,
      { force }
    );

    if (!imageUrl) {
      return NextResponse.json(
        { error: "Image generation did not produce a URL." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: { image_url: imageUrl } });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: msg || "Unknown error" },
      { status: 500 }
    );
  }
}
