import { NextRequest, NextResponse } from "next/server";

import { requireUser } from "@/app/api/_lib/auth";
import { ensureSharedPersonas } from "@/features/personas/services/globalPersonaPersistence";

export async function GET(request: NextRequest) {
  // Allow any authenticated user to read global personas (needed for chat UI)
  const auth = await requireUser(request);
  if ("error" in auth) {
    return auth.error;
  }
  const { supabase } = auth;

  try {
    await ensureSharedPersonas(supabase);

    const { data, error } = await supabase
      .from("global_personas")
      .select(
        "id, role_key, display_name, status, image_url, prompt, behavior_prompt, metadata, generated_by, last_generated_at, updated_at"
      )
      .order("role_key", { ascending: true });

    if (error) {
      console.error("Failed to load global personas", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ personas: data ?? [] });
  } catch (error) {
    console.error("Unhandled global personas GET error", error);
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
    console.error("Failed to parse global persona payload", error);
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return NextResponse.json(
      { error: "Persona update payload must be an object" },
      { status: 400 }
    );
  }

  const {
    id,
    role_key: roleKey,
    display_name: displayName,
    image_url: imageUrl,
    behavior_prompt: behaviorPrompt,
    metadata,
    prompt,
  } = payload as Record<string, unknown>;

  if (!id && !roleKey) {
    return NextResponse.json(
      { error: "Provide persona id or role_key" },
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
  if (typeof prompt === "string" || prompt === null) {
    updatePayload.prompt = prompt;
  }
  if (
    metadata === null ||
    (typeof metadata === "object" && !Array.isArray(metadata))
  ) {
    updatePayload.metadata = metadata as Record<string, unknown> | null;
  }

  if (!Object.keys(updatePayload).length) {
    return NextResponse.json(
      { error: "No persona fields provided for update" },
      { status: 400 }
    );
  }

  updatePayload.generated_by = "manual";

  try {
    let query = supabase.from("global_personas").update(updatePayload);

    if (id && typeof id === "string") {
      query = query.eq("id", id);
    } else if (typeof roleKey === "string") {
      query = query.eq("role_key", roleKey);
    }

    const { data, error } = await query
      .select(
        "id, role_key, display_name, status, image_url, prompt, behavior_prompt, metadata, generated_by, last_generated_at, updated_at"
      )
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Persona not found" },
          { status: 404 }
        );
      }
      console.error("Failed to update global persona", error);
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
    console.error("Unhandled global persona update error", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
