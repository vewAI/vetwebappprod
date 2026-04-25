import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export async function GET() {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Admin client not available" }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("nurse_specializations")
    .select("*")
    .order("species_key", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ specializations: data });
}

export async function POST(request: NextRequest) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Admin client not available" }, { status: 500 });
  }

  const body = await request.json();
  const { species_key, display_name, behavior_prompt, skills, lab_reference_ranges, vital_reference_ranges, common_pathologies, sex, voice_id, image_url, metadata } = body;

  if (!species_key || !display_name) {
    return NextResponse.json({ error: "species_key and display_name are required" }, { status: 400 });
  }

  const row = {
    species_key,
    display_name,
    behavior_prompt: behavior_prompt ?? "",
    skills: skills ?? [],
    lab_reference_ranges: lab_reference_ranges ?? {},
    vital_reference_ranges: vital_reference_ranges ?? {},
    common_pathologies: common_pathologies ?? [],
    sex: sex ?? null,
    voice_id: voice_id ?? null,
    image_url: image_url ?? null,
    metadata: metadata ?? {},
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("nurse_specializations")
    .upsert(row, { onConflict: "species_key" })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ specialization: data });
}

export async function DELETE(request: NextRequest) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Admin client not available" }, { status: 500 });
  }

  const { species_key } = await request.json();
  if (!species_key) {
    return NextResponse.json({ error: "species_key is required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("nurse_specializations")
    .delete()
    .eq("species_key", species_key);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
