import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
    if (!body.id || !body.title) {
      return NextResponse.json(
        { error: "id and title are required" },
        { status: 400 }
      );
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
