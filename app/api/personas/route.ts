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
    caseId,
    case_id: caseidAlt,
    roleKey,
    role_key: roleKeyAlt,
    displayName,
    display_name: displayNameAlt,
    imageUrl,
    image_url: imageUrlAlt,
    behaviorPrompt,
    behavior_prompt: behaviorPromptAlt,
    metadata: rawMetadata,
    prompt,
    sex,
    voiceId,
    sourcePersonaId,
  } = payload as Record<string, unknown>;

  // Normalize field names (support both camelCase and snake_case)
  const effectiveCaseId = (caseId ?? caseidAlt) as string | undefined;
  const effectiveRoleKey = (roleKey ?? roleKeyAlt) as string | undefined;
  const effectiveDisplayName = (displayName ?? displayNameAlt) as string | undefined;
  const effectiveImageUrl = (imageUrl ?? imageUrlAlt) as string | null | undefined;
  const effectiveBehaviorPrompt = (behaviorPrompt ?? behaviorPromptAlt) as string | null | undefined;

  if (!id && (!effectiveCaseId || !effectiveRoleKey)) {
    return NextResponse.json(
      { error: "Provide persona id or caseId and roleKey" },
      { status: 400 }
    );
  }

  // Build metadata with identity info
  let metadata = rawMetadata as Record<string, unknown> | null | undefined;
  if (sex || voiceId) {
    metadata = metadata ?? {};
    const identity = (metadata.identity as Record<string, unknown>) ?? {};
    if (sex) {
      identity.sex = sex;
      metadata.sex = sex;
    }
    if (voiceId) {
      identity.voiceId = voiceId;
      metadata.voiceId = voiceId;
    }
    metadata.identity = identity;
  }

  const updatePayload: Record<string, unknown> = {};

  if (typeof effectiveDisplayName === "string") {
    updatePayload.display_name = effectiveDisplayName;
  }
  if (typeof effectiveImageUrl === "string" || effectiveImageUrl === null) {
    updatePayload.image_url = effectiveImageUrl;
  }
  if (typeof effectiveBehaviorPrompt === "string" || effectiveBehaviorPrompt === null) {
    updatePayload.behavior_prompt = effectiveBehaviorPrompt;
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
    // First, try to update existing persona
    let query = supabase.from("case_personas").update(updatePayload);

    if (id && typeof id === "string") {
      query = query.eq("id", id);
    } else {
      query = query.eq("case_id", effectiveCaseId).eq("role_key", effectiveRoleKey);
    }

    const { data, error } = await query
      .select(
        "id, case_id, role_key, display_name, status, image_url, prompt, behavior_prompt, metadata, generated_by, last_generated_at, updated_at, sex"
      )
      .single();

    if (error) {
      // If persona doesn't exist, create it (upsert)
      if (error.code === "PGRST116" && effectiveCaseId && effectiveRoleKey) {
        const insertPayload = {
          case_id: effectiveCaseId,
          role_key: effectiveRoleKey,
          ...updatePayload,
          status: updatePayload.image_url ? "ready" : "pending",
        };
        
        const { data: insertedData, error: insertError } = await supabase
          .from("case_personas")
          .upsert(insertPayload, { onConflict: "case_id,role_key" })
          .select(
            "id, case_id, role_key, display_name, status, image_url, prompt, behavior_prompt, metadata, generated_by, last_generated_at, updated_at, sex"
          )
          .single();

        if (insertError) {
          console.error("Failed to upsert persona", insertError);
          return NextResponse.json({ error: insertError.message }, { status: 500 });
        }

        return NextResponse.json({ persona: insertedData });
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
