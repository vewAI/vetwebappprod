import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/app/api/_lib/auth";
import { applySpecializedNurse } from "@/features/personas/services/nurseSpecializationService";

export async function POST(request: NextRequest) {
  const auth = await requireUser(request, { requireAdmin: true });
  if ("error" in auth) {
    return auth.error;
  }
  const { supabase } = auth;

  try {
    const { data: cases, error } = await supabase
      .from("cases")
      .select("id, title, species, category, description");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const results: Array<{ id: string; title: string; species: string }> = [];
    for (const c of cases ?? []) {
      const speciesCandidate = (c.species as string | null) || (c.category as string | null) || c.title || c.description;
      if (speciesCandidate) {
        await applySpecializedNurse(supabase, c.id, speciesCandidate);
        results.push({ id: c.id, title: c.title, species: speciesCandidate });
      }
    }

    return NextResponse.json({
      success: true,
      updatedCount: results.length,
      cases: results,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
