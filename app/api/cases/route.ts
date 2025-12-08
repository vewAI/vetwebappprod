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
  normalizeCaseTimepointsInput,
  mapDbTimepoints,
  type CaseTimepoint,
} from "@/features/cases/models/caseTimepoint";
import {
  applyCaseDefaults,
  enrichCaseWithModel,
  mergeAugmentedFields,
  scrubConflictingSpeciesStrings,
} from "@/features/cases/services/caseCompletion";
import { replaceCaseTimepoints } from "@/features/cases/services/caseTimepointPersistence";
import { requireAdmin } from "@/app/api/_lib/auth";

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

function extractPersonaKey(raw: unknown): string | null {
  if (typeof raw === "string" && raw.trim()) {
    return raw.trim();
  }
  return null;
}
export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if ("error" in auth) {
    return auth.error;
  }
  const { supabase } = auth;
  const { data, error } = await supabase.from("cases").select("*");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const caseRows = Array.isArray(data) ? data : [];
  const caseIds = caseRows
    .map((row) => (typeof row?.id === "string" ? row.id : null))
    .filter((value): value is string => Boolean(value));

  const timepointsByCase: Record<string, CaseTimepoint[]> = {};
  if (caseIds.length > 0) {
    const { data: timepointRows, error: timepointError } = await supabase
      .from("case_timepoints")
      .select("*")
      .in("case_id", caseIds)
      .order("sequence", { ascending: true });

    if (timepointError) {
      return NextResponse.json(
        { error: timepointError.message },
        { status: 500 }
      );
    }

    if (Array.isArray(timepointRows) && timepointRows.length > 0) {
      const normalized = mapDbTimepoints(timepointRows);
      for (const timepoint of normalized) {
        const caseId = timepoint.caseId;
        if (!caseId) continue;
        if (!timepointsByCase[caseId]) {
          timepointsByCase[caseId] = [];
        }
        timepointsByCase[caseId] = [
          ...timepointsByCase[caseId],
          timepoint,
        ].sort((a, b) => a.sequence - b.sequence);
      }
    }
  }

  const enriched = caseRows.map((row) => {
    const caseId = typeof row?.id === "string" ? row.id : null;
    const timepoints = caseId ? timepointsByCase[caseId] ?? [] : [];
    return { ...row, timepoints };
  });

  return NextResponse.json(enriched);
}

export async function POST(req: Request) {
  const auth = await requireAdmin(req);
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

    // Convert estimated_time to number if present
    const rawEstimated = body["estimated_time"];
    if (rawEstimated !== undefined && rawEstimated !== "") {
      const n = Number(rawEstimated as unknown);
      if (isNaN(n)) {
        return NextResponse.json(
          { error: "estimated_time must be a number" },
          { status: 400 }
        );
      }
      body["estimated_time"] = n;
    } else {
      body["estimated_time"] = null;
    }

    // Convert details to JSON if present and not empty
    const rawDetails = body["details"];
    if (rawDetails !== undefined && rawDetails !== "") {
      try {
        if (typeof rawDetails === "string") {
          body["details"] = JSON.parse(rawDetails as string);
        }
      } catch {
        // If not valid JSON, keep as string
        body["details"] = rawDetails;
      }
    } else {
      body["details"] = null;
    }

    // Normalize multimedia payloads
    if (Object.prototype.hasOwnProperty.call(body, "media")) {
      const rawMedia = body["media"];
      let parsedMedia: unknown = rawMedia;
      if (typeof rawMedia === "string") {
        try {
          parsedMedia = JSON.parse(rawMedia);
        } catch {
          parsedMedia = [];
        }
      }
      body["media"] = normalizeIncomingMedia(parsedMedia);
    } else {
      body["media"] = [];
    }

    const hasTimepointPayload = Object.prototype.hasOwnProperty.call(
      body,
      "timepoints"
    );
    const caseTimepointsInput = hasTimepointPayload
      ? normalizeCaseTimepointsInput(body["timepoints"])
      : [];
    if (hasTimepointPayload) {
      delete body["timepoints"];
    }

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

    const ownerAvatarKey = extractPersonaKey(body["owner_avatar_key"]);
    if (!ownerAvatarKey) {
      return NextResponse.json(
        { error: "owner_avatar_key is required" },
        { status: 400 }
      );
    }
    body["owner_avatar_key"] = ownerAvatarKey;

    const nurseAvatarKey = extractPersonaKey(body["nurse_avatar_key"]);
    if (!nurseAvatarKey) {
      return NextResponse.json(
        { error: "nurse_avatar_key is required" },
        { status: 400 }
      );
    }
    body["nurse_avatar_key"] = nurseAvatarKey;

    // Save a checkpoint of the raw incoming payload before any augmentation.
    try {
      const checkpointPayload = hasTimepointPayload
        ? { ...body, timepoints: caseTimepointsInput }
        : { ...body };
      await supabase.from("case_checkpoints").insert([
        {
          case_id: body["id"] ?? null,
          payload: checkpointPayload,
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

    let persistedTimepoints: CaseTimepoint[] = [];
    if (insertedCase?.id) {
      if (hasTimepointPayload) {
        const { data: timepointData, error: timepointError } =
          await replaceCaseTimepoints(
            supabase,
            insertedCase.id,
            caseTimepointsInput
          );
        if (timepointError) {
          // Attempt to roll back the inserted case to keep data consistent.
          try {
            await supabase.from("cases").delete().eq("id", insertedCase.id);
          } catch (rollbackErr) {
            console.warn("Failed to rollback case after timepoint error", rollbackErr);
          }
          return NextResponse.json(
            {
              error: `Failed to save timepoints: ${timepointError.message}`,
            },
            { status: 500 }
          );
        }
        persistedTimepoints = timepointData;
      }
      await ensureCasePersonas(supabase, insertedCase.id, body);
      scheduleCasePersonaPortraitGeneration(supabase, openai, insertedCase.id);
      scheduleCaseImageGeneration(
        supabase,
        openai,
        insertedCase as Record<string, unknown>,
        { force: !insertedCase?.image_url }
      );
    }
    const responsePayload = hasTimepointPayload
      ? { success: true, data, timepoints: persistedTimepoints }
      : { success: true, data };
    return NextResponse.json(responsePayload);
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
  const auth = await requireAdmin(req);
  if ("error" in auth) {
    return auth.error;
  }
  const { supabase } = auth;
  try {
    const body = await req.json();
    if (!body || !body.id) {
      return NextResponse.json(
        { error: "id is required for update" },
        { status: 400 }
      );
    }

    const ownerAvatarKey = extractPersonaKey(body.owner_avatar_key);
    if (!ownerAvatarKey) {
      return NextResponse.json(
        { error: "owner_avatar_key is required" },
        { status: 400 }
      );
    }
    body.owner_avatar_key = ownerAvatarKey;

    const nurseAvatarKey = extractPersonaKey(body.nurse_avatar_key);
    if (!nurseAvatarKey) {
      return NextResponse.json(
        { error: "nurse_avatar_key is required" },
        { status: 400 }
      );
    }
    body.nurse_avatar_key = nurseAvatarKey;

    const hasTimepointPayload = Object.prototype.hasOwnProperty.call(
      body,
      "timepoints"
    );
    const caseTimepointsInput = hasTimepointPayload
      ? normalizeCaseTimepointsInput(body.timepoints)
      : null;
    if (hasTimepointPayload) {
      delete body.timepoints;
    }

    // Convert estimated_time to number if present
    if (body.estimated_time !== undefined && body.estimated_time !== "") {
      body.estimated_time = Number(body.estimated_time);
      if (isNaN(body.estimated_time)) {
        return NextResponse.json(
          { error: "estimated_time must be a number" },
          { status: 400 }
        );
      }
    } else {
      body.estimated_time = null;
    }

    if (Object.prototype.hasOwnProperty.call(body, "media")) {
      const rawMedia = body.media;
      let parsedMedia: unknown = rawMedia;
      if (typeof rawMedia === "string") {
        try {
          parsedMedia = JSON.parse(rawMedia as string);
        } catch {
          parsedMedia = [];
        }
      }
      body.media = normalizeIncomingMedia(parsedMedia);
    }

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

    let persistedTimepoints: CaseTimepoint[] | null = null;
    if (data?.id && hasTimepointPayload) {
      const { data: timepointData, error: timepointError } =
        await replaceCaseTimepoints(supabase, data.id, caseTimepointsInput ?? []);
      if (timepointError) {
        return NextResponse.json(
          {
            error: `Failed to save timepoints: ${timepointError.message}`,
          },
          { status: 500 }
        );
      }
      persistedTimepoints = timepointData;
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

    const responsePayload =
      hasTimepointPayload && persistedTimepoints !== null
        ? { success: true, data, timepoints: persistedTimepoints }
        : { success: true, data };
    return NextResponse.json(responsePayload);
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
  const auth = await requireAdmin(req);
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
