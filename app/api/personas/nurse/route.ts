import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/app/api/_lib/auth";
import { normalizeSpeciesKey } from "@/features/cases/services/caseCompletion";

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if ("error" in auth) return auth.error;
  const { supabase } = auth;

  const speciesRaw = request.nextUrl.searchParams.get("species") ?? undefined;
  if (!speciesRaw) {
    return NextResponse.json({ error: "species query param is required" }, { status: 400 });
  }

  try {
    // Normalize to the canonical key ("dog" → "canine", etc.) to match DB records
    const key = normalizeSpeciesKey(speciesRaw) ?? speciesRaw.trim().toLowerCase();
    const { data, error } = await supabase.from("nurse_specializations").select("*").eq("species_key", key).limit(1).maybeSingle();
    if (error) {
      console.error("Failed to load nurse specialization", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!data) return NextResponse.json({ nurse: null });

    const nurse = {
      id: data.id,
      speciesKey: data.species_key,
      displayName: data.display_name,
      imageUrl: data.image_url ?? null,
      behaviorPrompt: data.behavior_prompt ?? null,
      skills: data.skills ?? [],
      metadata: data.metadata ?? null,
    };

    return NextResponse.json({ nurse });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Unhandled nurse API error", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
