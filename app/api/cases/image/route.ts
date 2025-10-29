import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseServiceKey) {
  // Fail fast in dev so we don't silently attempt anon updates that RLS will reject.
  console.error(
    "SUPABASE_SERVICE_ROLE_KEY is not set. /api/cases/image requires a service role key."
  );
}

const _supabaseKey =
  supabaseServiceKey ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const supabase = createClient(supabaseUrl, _supabaseKey);

export async function PUT(req: Request) {
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
