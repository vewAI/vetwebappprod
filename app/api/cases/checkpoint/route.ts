import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(
  supabaseUrl,
  supabaseServiceKey ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const caseId = body?.case_id ?? null;
    const payload = body?.payload ?? null;

    if (!payload) {
      return NextResponse.json(
        { error: "payload is required" },
        { status: 400 }
      );
    }

    const insert = {
      case_id: caseId,
      payload,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("case_checkpoints")
      .insert([insert])
      .select();
    if (error) {
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
