import { NextResponse } from "next/server";
import OpenAi from "openai";
import crypto from "crypto";
import { ensureCasePersonas } from "@/features/personas/services/casePersonaPersistence";
import { scheduleCasePersonaPortraitGeneration } from "@/features/personas/services/personaImageService";
import { scheduleCaseImageGeneration } from "@/features/cases/services/caseImageService";
import {
  normalizeCaseMedia,
  type CaseMediaItem,
} from "@/features/cases/models/caseMedia";
import {
  applyCaseDefaults,
  enrichCaseWithModel,
  mergeAugmentedFields,
  scrubConflictingSpeciesStrings,
} from "@/features/cases/services/caseCompletion";
import { requireUser } from "@/app/api/_lib/auth";

const openai = new OpenAi({ apiKey: process.env.OPENAI_API_KEY });

function normalizeIncomingMedia(raw: unknown): CaseMediaItem[] {
  const normalized = normalizeCaseMedia(raw);
  return normalized.map((item) => {
    const hasId = typeof item.id === "string" && item.id.trim().length > 0;
    const generatedId =
      typeof (crypto as unknown as { randomUUID?: () => string }).randomUUID ===
      "function"
        ? (crypto as unknown as { randomUUID: () => string }).randomUUID()
        : `${Date.now()}-${Math.random()}`;
    return {
      metadata: item.metadata ?? null,
      ...item,
      id: hasId ? item.id.trim() : generatedId,
    } satisfies CaseMediaItem;
  });
}

function normalizeCaseBody(body: Record<string, unknown>): Record<string, unknown> {
  const next = { ...body };

  // estimated_time
  if (next["estimated_time"] !== undefined && next["estimated_time"] !== "") {
    const n = Number(next["estimated_time"]);
    next["estimated_time"] = isNaN(n) ? null : n;
  } else {
    next["estimated_time"] = null;
  }

  // details
  if (next["details"] !== undefined && next["details"] !== "") {
    try {
      if (typeof next["details"] === "string") {
        next["details"] = JSON.parse(next["details"] as string);
      }
    } catch {
      // keep as string
    }
  } else {
    next["details"] = null;
  }

  // media
  if (Object.prototype.hasOwnProperty.call(next, "media")) {
    const rawMedia = next["media"];
    let parsedMedia: unknown = rawMedia;
    if (typeof rawMedia === "string") {
      try {
        parsedMedia = JSON.parse(rawMedia);
      } catch {
        parsedMedia = [];
      }
    }
    next["media"] = normalizeIncomingMedia(parsedMedia);
  } else {
    next["media"] = [];
  }

  // tags
  if (next["tags"] !== undefined) {
    if (typeof next["tags"] === "string") {
      next["tags"] = next["tags"].split(",").map((t: string) => t.trim()).filter((t: string) => t.length > 0);
    } else if (!Array.isArray(next["tags"])) {
      next["tags"] = [];
    }
  }

  // is_published
  if (next["is_published"] !== undefined) {
    if (typeof next["is_published"] === "string") {
      next["is_published"] = next["is_published"] === "true";
    } else {
      next["is_published"] = Boolean(next["is_published"]);
    }
  }

  // version
  if (next["version"] !== undefined && next["version"] !== "") {
    const v = Number(next["version"]);
    next["version"] = isNaN(v) ? 1 : Math.floor(v);
  }

  return next;
}

export async function GET(req: Request) {
  const auth = await requireUser(req, { requireAdmin: true });
  if ("error" in auth) {
    return auth.error;
  }
  const { supabase } = auth;
  const { data, error } = await supabase.from("cases").select("*");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const auth = await requireUser(req, { requireAdmin: true });
  if ("error" in auth) {
    return auth.error;
  }
  const { supabase } = auth;
  try {
    // Read raw text first and provide a clearer error for empty or malformed bodies.
    const raw = await req.text();
    if (!raw || raw.trim() === "") {
      return NextResponse.json(
        { error: "Empty request body" },
        { status: 400 }
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // If JSON.parse fails, try the structured parser as a fallback.
      try {
        parsed = await req.json();
      } catch {
        // Last resort: store raw text under details so we don't lose data.
        parsed = { details: raw };
      }
    }

    // Work with a typed record so we can safely read/write keys without `any`.
    let body: Record<string, unknown> = {};
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      body = parsed as Record<string, unknown>;
    } else {
      body = { details: String(parsed ?? "") };
    }

    // Normalize fields (estimated_time, details, media, tags, etc.)
    body = normalizeCaseBody(body);

    // Validate required fields (customize as needed)
    // If no id provided, generate one from title or uuid so the UI doesn't have to supply it.
    if (!body["title"] || String(body["title"]).trim() === "") {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }
    if (!body["id"] || String(body["id"]).trim() === "") {
      // generate a safe id: slug of title + random suffix
      const slug = String(body["title"] ?? "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      const suffix = crypto?.randomUUID
        ? crypto.randomUUID().split("-")[0]
        : String(Date.now());
      body["id"] = `${slug}-${suffix}`;
    }

    // Save a checkpoint of the raw incoming payload before any augmentation.
    try {
      await supabase.from("case_checkpoints").insert([
        {
          case_id: body["id"] ?? null,
          payload: body,
          created_at: new Date().toISOString(),
        },
      ]);
    } catch (ckErr) {
      // Non-fatal: log and continue. Checkpoint table may not exist in some envs.
      console.warn("Could not write case checkpoint:", ckErr);
    }

    const baseSpecies =
      typeof body["species"] === "string" ? body["species"] : null;
    scrubConflictingSpeciesStrings(body, baseSpecies);
    applyCaseDefaults(body);

    // Attempt to enrich and expand case fields by asking the LLM to complete
    // any missing or terse fields. The model is asked to return a JSON object
    // with the same keys. This is best-effort — failures here will not block
    // insertion.
    try {
      const parsedFromModel = await enrichCaseWithModel(body, openai);
      body = mergeAugmentedFields(body, parsedFromModel, {
        species: baseSpecies,
      });
    } catch (llmErr) {
      console.warn("LLM enrichment failed for new case:", llmErr);
    }

    // Insert into Supabase and request the inserted row(s) back
    // using .select() so the response contains the inserted record instead of null.
    const { data, error } = await supabase
      .from("cases")
      .insert([body])
      .select();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    const insertedCase = Array.isArray(data) ? data[0] : data;

    if (insertedCase?.id) {
      await ensureCasePersonas(supabase, insertedCase.id, body);
      scheduleCasePersonaPortraitGeneration(supabase, openai, insertedCase.id);
      scheduleCaseImageGeneration(
        supabase,
        openai,
        insertedCase as Record<string, unknown>,
        { force: !insertedCase?.image_url }
      );
    }
    return NextResponse.json({ success: true, data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: msg || "Unknown error" },
      { status: 500 }
    );
  }
}

// Allow updating an existing case via PUT
export async function PUT(req: Request) {
  const auth = await requireUser(req, { requireAdmin: true });
  if ("error" in auth) {
    return auth.error;
  }
  const { supabase } = auth;
  try {
    let body = await req.json();
    if (!body || !body.id) {
      return NextResponse.json(
        { error: "id is required for update" },
        { status: 400 }
      );
    }

    body = normalizeCaseBody(body);

    // Try to update the row
    const { data, error } = await supabase
      .from("cases")
      .update(body)
      .eq("id", body.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (data?.id) {
      await ensureCasePersonas(supabase, data.id, body);
      scheduleCasePersonaPortraitGeneration(supabase, openai, data.id);
      scheduleCaseImageGeneration(
        supabase,
        openai,
        data as Record<string, unknown>,
        { force: !data?.image_url }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: msg || "Unknown error" },
      { status: 500 }
    );
  }
}

// Delete a case by id (query param ?id=...)
export async function DELETE(req: Request) {
  const auth = await requireUser(req, { requireAdmin: true });
  if ("error" in auth) {
    return auth.error;
  }
  const { supabase } = auth;
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return NextResponse.json(
        { error: "id query param is required" },
        { status: 400 }
      );
    }

    const { error } = await supabase.from("cases").delete().eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: msg || "Unknown error" },
      { status: 500 }
    );
  }
}
