import { NextRequest, NextResponse } from "next/server";
import OpenAi from "openai";

import { requireUser } from "@/app/api/_lib/auth";
import {
  ROLE_PROMPT_DEFINITIONS,
  type RolePromptKey,
} from "@/features/role-info/services/roleInfoService";
import { generateRolePromptOverride } from "@/features/personas/services/personaPromptGenerator";
import {
  loadCaseRow,
  loadPersonaForGeneration,
} from "@/features/personas/services/personaGenerationShared";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.warn("OPENAI_API_KEY is not defined. Role prompt auto-generation will fail.");
}

const openaiClient = OPENAI_API_KEY ? new OpenAi({ apiKey: OPENAI_API_KEY }) : null;

function isRolePromptKey(value: unknown): value is RolePromptKey {
  if (typeof value !== "string") return false;
  return Object.prototype.hasOwnProperty.call(ROLE_PROMPT_DEFINITIONS, value);
}

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
    console.error("Failed to parse role prompt payload", error);
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return NextResponse.json(
      { error: "Role prompt payload must be an object" },
      { status: 400 }
    );
  }

  const {
    roleKey,
    role_key: roleKeySnake,
    promptKey,
    prompt_key: promptKeySnake,
    caseId,
    case_id: caseIdSnake,
  } = payload as Record<string, unknown>;

  const resolvedRoleKey =
    typeof roleKey === "string"
      ? roleKey
      : typeof roleKeySnake === "string"
        ? roleKeySnake
        : null;
  const resolvedPromptKeyRaw =
    typeof promptKey === "string"
      ? promptKey
      : typeof promptKeySnake === "string"
        ? promptKeySnake
        : null;
  const resolvedCaseId =
    typeof caseId === "string"
      ? caseId
      : typeof caseIdSnake === "string"
        ? caseIdSnake
        : null;

  if (!resolvedRoleKey) {
    return NextResponse.json(
      { error: "roleKey is required" },
      { status: 400 }
    );
  }

  if (!resolvedPromptKeyRaw || !isRolePromptKey(resolvedPromptKeyRaw)) {
    return NextResponse.json(
      { error: "promptKey must be a valid role prompt identifier" },
      { status: 400 }
    );
  }

  const promptDefinition = ROLE_PROMPT_DEFINITIONS[resolvedPromptKeyRaw];
  if (!promptDefinition) {
    return NextResponse.json(
      { error: "promptKey is not configured" },
      { status: 400 }
    );
  }

  if (resolvedRoleKey === "owner" && !resolvedCaseId) {
    return NextResponse.json(
      { error: "caseId is required when generating owner prompts" },
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

  const caseRow = resolvedCaseId ? await loadCaseRow(supabase, resolvedCaseId) : null;

  try {
    const promptText = await generateRolePromptOverride({
      openai: openaiClient,
      persona,
      promptKey: resolvedPromptKeyRaw,
      defaultTemplate: promptDefinition.defaultTemplate,
      placeholders: promptDefinition.placeholderDocs,
      caseRow,
    });

    return NextResponse.json({ prompt: promptText });
  } catch (error) {
    console.error("Unhandled role prompt generation error", error);
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
