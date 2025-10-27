import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function GET() {
  const { data, error } = await supabase.from("cases").select("*");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

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
      const suffix = crypto?.randomUUID ? crypto.randomUUID().split("-")[0] : String(Date.now());
      body.id = `${slug}-${suffix}`;
    }

    // Insert into Supabase
    const { data, error } = await supabase.from("cases").insert([body]);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Unknown error" },
      { status: 500 }
    );
  }
}
