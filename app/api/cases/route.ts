import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
// Prefer a server-side service role key for inserts so RLS doesn't block server handlers.
// NOTE: Never expose the SERVICE_ROLE key to the browser. It must be set only on the server (.env.local and on Vercel as a secret).
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(
  supabaseUrl,
  supabaseServiceKey ?? supabaseAnonKey
);

export async function GET() {
  const { data, error } = await supabase.from("cases").select("*");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  try {
    // Read raw text first and provide a clearer error for empty or malformed bodies.
    const raw = await req.text();
    if (!raw || raw.trim() === "") {
      return NextResponse.json(
        { error: "Empty request body" },
        { status: 400 }
      );
    }

    let body: any;
    try {
      body = JSON.parse(raw);
    } catch {
      // If JSON.parse fails, try the structured parser as a fallback.
      try {
        body = await req.json();
      } catch {
        // Last resort: store raw text under details so we don't lose data.
        body = { details: raw } as any;
      }
    }

    // Convert estimated_time to number if present
    if (body.estimated_time !== undefined && body.estimated_time !== "") {
      body.estimated_time = Number(body.estimated_time);
      if (isNaN(body.estimated_time)) {
        return NextResponse.json(
          { error: "estimated_time must be a number" },
          { status: 400 }
        );
      }
    } else {
      body.estimated_time = null;
    }

    // Convert details to JSON if present and not empty
    if (body.details !== undefined && body.details !== "") {
      try {
        body.details = JSON.parse(body.details);
      } catch {
        // If not valid JSON, store as string
        body.details = body.details;
      }
    } else {
      body.details = null;
    }

    // Validate required fields (customize as needed)
    // If no id provided, generate one from title or uuid so the UI doesn't have to supply it.
    if (!body.title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }
    if (!body.id || body.id === "") {
      // generate a safe id: slug of title + random suffix
      const slug = (body.title as string)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      const suffix = crypto?.randomUUID
        ? crypto.randomUUID().split("-")[0]
        : String(Date.now());
      body.id = `${slug}-${suffix}`;
    }

    // Insert into Supabase and request the inserted row(s) back
    // using .select() so the response contains the inserted record instead of null.
    const { data, error } = await supabase
      .from("cases")
      .insert([body])
      .select();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
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

// Allow updating an existing case via PUT
export async function PUT(req: Request) {
  try {
    const body = await req.json();
    if (!body || !body.id) {
      return NextResponse.json(
        { error: "id is required for update" },
        { status: 400 }
      );
    }

    // Convert estimated_time to number if present
    if (body.estimated_time !== undefined && body.estimated_time !== "") {
      body.estimated_time = Number(body.estimated_time);
      if (isNaN(body.estimated_time)) {
        return NextResponse.json(
          { error: "estimated_time must be a number" },
          { status: 400 }
        );
      }
    } else {
      body.estimated_time = null;
    }

    // Try to update the row
    const { data, error } = await supabase
      .from("cases")
      .update(body)
      .eq("id", body.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
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

// Delete a case by id (query param ?id=...)
export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return NextResponse.json(
        { error: "id query param is required" },
        { status: 400 }
      );
    }

    const { error } = await supabase.from("cases").delete().eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: msg || "Unknown error" },
      { status: 500 }
    );
  }
}
