import { NextRequest, NextResponse } from "next/server";
import OpenAi from "openai";

import { requireUser } from "@/app/api/_lib/auth";
import { generateBehaviorPrompt } from "@/features/personas/services/personaPromptGenerator";
import {
  loadCaseRow,
  loadPersonaForGeneration,
} from "@/features/personas/services/personaGenerationShared";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.warn("OPENAI_API_KEY is not defined. Persona auto-behaviour generation will fail.");
}

const openaiClient = OPENAI_API_KEY ? new OpenAi({ apiKey: OPENAI_API_KEY }) : null;

export async function POST(request: NextRequest) {
  const auth = await requireUser(request, { requireAdmin: true });
  if ("error" in auth) {
    return auth.error;
  }
  const { supabase } = auth;

  if (!openaiClient) {
    return NextResponse.json(
      { error: "OpenAI API key not configured" },
      { status: 500 }
    );
  }

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

  if (isOwner && !resolvedCaseId) {
    return NextResponse.json(
      { error: "caseId is required for owner persona" },
      { status: 400 }
    );
  }

  const persona = await loadPersonaForGeneration(supabase, {
    roleKey: resolvedRoleKey,
    caseId: resolvedCaseId,
  });

  if (!persona) {
    return NextResponse.json(
      { error: "Persona not found" },
      { status: 404 }
    );
  }

  const caseRow = isOwner && resolvedCaseId ? await loadCaseRow(supabase, resolvedCaseId) : null;

  try {
    const behaviorPrompt = await generateBehaviorPrompt({
      openai: openaiClient,
      persona,
      caseRow,
    });

    return NextResponse.json({
      persona: {
        role_key: persona.role_key,
        case_id: persona.case_id ?? resolvedCaseId ?? null,
        display_name: persona.display_name,
        behavior_prompt: behaviorPrompt,
        prompt: persona.prompt,
        metadata: persona.metadata ?? null,
      },
    });
  } catch (error) {
    console.error("Unhandled persona auto behavior error", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
