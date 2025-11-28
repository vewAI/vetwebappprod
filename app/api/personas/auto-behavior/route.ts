import { NextRequest, NextResponse } from "next/server";

import { requireUser } from "@/app/api/_lib/auth";
import {
  SHARED_CASE_ID,
  buildPersonaSeeds,
  buildSharedPersonaSeeds,
} from "@/features/personas/services/personaSeedService";
import { ensureSharedPersonas } from "@/features/personas/services/globalPersonaPersistence";

export async function POST(request: NextRequest) {
  const auth = await requireUser(request, { requireAdmin: true });
  if ("error" in auth) {
    return auth.error;
  }
  const { supabase } = auth;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch (error) {
    console.error("Failed to parse auto behavior payload", error);
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return NextResponse.json(
      { error: "Auto behavior payload must be an object" },
      { status: 400 }
    );
  }

  const { caseId, case_id: caseIdSnake, roleKey, role_key: roleKeySnake } =
    payload as Record<string, unknown>;

  const resolvedCaseId =
    typeof caseId === "string"
      ? caseId
      : typeof caseIdSnake === "string"
        ? caseIdSnake
        : null;
  const resolvedRoleKey =
    typeof roleKey === "string"
      ? roleKey
      : typeof roleKeySnake === "string"
        ? roleKeySnake
        : null;

  if (!resolvedRoleKey) {
    return NextResponse.json(
      { error: "roleKey is required" },
      { status: 400 }
    );
  }

  const isOwner = resolvedRoleKey === "owner";

  if (!isOwner && resolvedCaseId && typeof resolvedCaseId !== "string") {
    return NextResponse.json(
      { error: "Invalid caseId" },
      { status: 400 }
    );
  }

  try {
    if (!isOwner) {
      await ensureSharedPersonas(supabase);
      const seeds = buildSharedPersonaSeeds();
      const seed = seeds.find((entry) => entry.roleKey === resolvedRoleKey);

      if (!seed) {
        return NextResponse.json(
          { error: "Shared persona template not found for role" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        persona: {
          role_key: seed.roleKey,
          case_id: SHARED_CASE_ID,
          display_name: seed.displayName,
          behavior_prompt: seed.behaviorPrompt,
          prompt: seed.prompt,
          metadata: seed.metadata ?? null,
        },
      });
    }

    if (!resolvedCaseId) {
      return NextResponse.json(
        { error: "caseId is required for owner persona" },
        { status: 400 }
      );
    }

    const { data: caseRow, error } = await supabase
      .from("cases")
      .select("*")
      .eq("id", resolvedCaseId)
      .maybeSingle();

    if (error) {
      console.error("Failed to load case for persona auto behavior", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!caseRow) {
      return NextResponse.json(
        { error: "Case not found" },
        { status: 404 }
      );
    }

    // Recreate the persona template so we can return the canonical behavior prompt.
    const seeds = buildPersonaSeeds(
      resolvedCaseId,
      caseRow as Record<string, unknown>
    );
    const seed = seeds.find((entry) => entry.roleKey === resolvedRoleKey);

    if (!seed) {
      return NextResponse.json(
        { error: "Persona template not found for role" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      persona: {
        role_key: seed.roleKey,
        case_id: resolvedCaseId,
        display_name: seed.displayName,
        behavior_prompt: seed.behaviorPrompt,
        prompt: seed.prompt,
        metadata: seed.metadata ?? null,
      },
    });
  } catch (error) {
    console.error("Unhandled persona auto behavior error", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
