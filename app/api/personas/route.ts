import { NextRequest, NextResponse } from "next/server";

import { requireUser } from "@/app/api/_lib/auth";

export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if ("error" in auth) {
    return auth.error;
  }
  const { supabase } = auth;
  const caseId = request.nextUrl.searchParams.get("caseId");
  if (!caseId) {
    return NextResponse.json(
      { error: "caseId query param is required" },
      { status: 400 }
    );
  }

  try {
    const { data, error } = await supabase
      .from("case_personas")
      .select(
        "id, case_id, role_key, display_name, status, image_url, prompt, behavior_prompt, metadata, generated_by, last_generated_at, updated_at, sex"
      )
      .eq("case_id", caseId)
      .order("role_key", { ascending: true });

    if (error) {
      console.error(
        "Failed to load personas",
        JSON.stringify({ caseId, message: error.message, details: error.details, hint: error.hint })
      );
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ personas: data ?? [] });
  } catch (error) {
    console.error("Unhandled personas API error", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireUser(request, { requireAdmin: true });
  if ("error" in auth) {
    return auth.error;
  }
  const { supabase } = auth;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch (error) {
    console.error("Failed to parse persona update payload", error);
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return NextResponse.json(
      { error: "Persona update payload must be an object" },
      { status: 400 }
    );
  }

  const {
    id,
    case_id: caseId,
    role_key: roleKey,
    display_name: displayName,
    image_url: imageUrl,
    behavior_prompt: behaviorPrompt,
    metadata,
    prompt,
    sex,
  } = payload as Record<string, unknown>;

  if (!id && (!caseId || !roleKey)) {
    return NextResponse.json(
      { error: "Provide persona id or case_id and role_key" },
      { status: 400 }
    );
  }

  const updatePayload: Record<string, unknown> = {};

  if (typeof displayName === "string") {
    updatePayload.display_name = displayName;
  }
  if (typeof imageUrl === "string" || imageUrl === null) {
    updatePayload.image_url = imageUrl;
  }
  if (typeof behaviorPrompt === "string" || behaviorPrompt === null) {
    updatePayload.behavior_prompt = behaviorPrompt;
  }
  if (typeof sex === "string" && ["male", "female", "neutral"].includes(sex)) {
    updatePayload.sex = sex;
  }
  if (
    metadata === null ||
    (typeof metadata === "object" && !Array.isArray(metadata))
  ) {
    updatePayload.metadata = metadata as Record<string, unknown> | null;
  }
  if (typeof prompt === "string" || prompt === null) {
    updatePayload.prompt = prompt;
  }

  // Mark manual edits so automated refresh jobs do not overwrite admin changes.
  updatePayload.generated_by = "manual";

  if (!Object.keys(updatePayload).length) {
    return NextResponse.json(
      { error: "No persona fields provided for update" },
      { status: 400 }
    );
  }

  try {
    let query = supabase.from("case_personas").update(updatePayload);

    if (id && typeof id === "string") {
      query = query.eq("id", id);
    } else {
      query = query.eq("case_id", caseId).eq("role_key", roleKey);
    }

    const { data, error } = await query
      .select(
        "id, case_id, role_key, display_name, status, image_url, prompt, behavior_prompt, metadata, generated_by, last_generated_at, updated_at, sex"
      )
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Persona not found" },
          { status: 404 }
        );
      }
      console.error("Failed to update persona", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json(
        { error: "Persona not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ persona: data });
  } catch (error) {
    console.error("Unhandled persona update error", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
