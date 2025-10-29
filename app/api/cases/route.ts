import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import OpenAi from "openai";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
// Prefer a server-side service role key for inserts so RLS doesn't block server handlers.
// NOTE: Never expose the SERVICE_ROLE key to the browser. It must be set only on the server (.env.local and on Vercel as a secret).
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(
  supabaseUrl,
  supabaseServiceKey ?? supabaseAnonKey
);

const openai = new OpenAi({ apiKey: process.env.OPENAI_API_KEY });

export async function GET() {
  const { data, error } = await supabase.from("cases").select("*");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  try {
    // Read raw text first and provide a clearer error for empty or malformed bodies.
    const raw = await req.text();
    if (!raw || raw.trim() === "") {
      return NextResponse.json(
        { error: "Empty request body" },
        { status: 400 }
      );
    }

    let body: any;
    try {
      body = JSON.parse(raw);
    } catch {
      // If JSON.parse fails, try the structured parser as a fallback.
      try {
        body = await req.json();
      } catch {
        // Last resort: store raw text under details so we don't lose data.
        body = { details: raw } as any;
      }
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

    // Convert details to JSON if present and not empty
    if (body.details !== undefined && body.details !== "") {
      try {
        body.details = JSON.parse(body.details);
      } catch {
        // If not valid JSON, store as string
        body.details = body.details;
      }
    } else {
      body.details = null;
    }

    // Validate required fields (customize as needed)
    // If no id provided, generate one from title or uuid so the UI doesn't have to supply it.
    if (!body.title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }
    if (!body.id || body.id === "") {
      // generate a safe id: slug of title + random suffix
      const slug = (body.title as string)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      const suffix = crypto?.randomUUID
        ? crypto.randomUUID().split("-")[0]
        : String(Date.now());
      body.id = `${slug}-${suffix}`;
    }

    // Save a checkpoint of the raw incoming payload before any augmentation.
    try {
      await supabase.from("case_checkpoints").insert([
        {
          case_id: body.id ?? null,
          payload: body,
          created_at: new Date().toISOString(),
        },
      ]);
    } catch (ckErr) {
      // Non-fatal: log and continue. Checkpoint table may not exist in some envs.
      console.warn("Could not write case checkpoint:", ckErr);
    }

    // Apply intelligent defaults for missing fields using case-1 templates,
    // but adapt them to the provided title/id where sensible.
    const horseName = body.title || body.id || "the patient";

    const species = (body.species || "").toString();
    const speciesLower = species.toLowerCase();
    const condition = (body.condition || "").toString();
    const conditionLower = condition.toLowerCase();

    const diagnostic_findings_template = `Note: Only provide results for tests specifically requested by the student. If they request other tests not listed here, results should be within normal range but note these may be unnecessary tests.`;

    const description_template = body.title
      ? `${body.title} - ${condition || "clinical signs"}`
      : `A ${species || "patient"} presenting with ${
          condition || "clinical signs"
        }.`;

    const details_template: any = {
      presenting_complaint:
        body.description || `Presenting for ${condition || "clinical signs"}`,
      duration: body.estimated_time
        ? `${body.estimated_time} minutes`
        : "Unknown",
      notes: "Provide additional details when available.",
    };

    // Difficulty heuristic
    let difficulty_template = "Easy";
    if (
      /severe|shock|critical|collapse|fracture|laminitis|sepsis|er/i.test(
        conditionLower
      )
    ) {
      difficulty_template = "Hard";
    } else if (/moderate|chronic|recurring|suspected/i.test(conditionLower)) {
      difficulty_template = "Medium";
    }

    // Estimated time default (minutes)
    const estimated_time_template = 15;

    // Physical exam findings - adapt by species when possible
    let physical_exam_findings_template =
      "No abnormalities detected on brief physical exam.";
    if (
      /horse|equine/i.test(speciesLower) ||
      /equine|horse/i.test(conditionLower) ||
      /horse/i.test(body.title || "")
    ) {
      physical_exam_findings_template = `Heart rate: 36-44 bpm (may be elevated if stressed); Temperature: 37.5-39.5°C (pyrexia if infected); Respiratory rate: 8-20 bpm; Mucous membranes: pink and moist; Localised pain on palpation of affected area.`;
    } else if (species) {
      physical_exam_findings_template = `Physical exam within expected limits for ${species}. Note any localised pain or abnormal vital signs.`;
    }

    const owner_background_template = `Role: Horse Owner (Female, initially worried but responsive to reassurance)\nHorse: ${horseName}\n\nPrimary Concern:\n- ${horseName} is off colour and not eating well\n\nClinical Information (ONLY PROVIDE WHEN SPECIFICALLY REQUESTED):\n1. Current Symptoms:\n- Poor appetite\n- Quieter than usual\n- No nasal discharge noticed\n\n2. Living Situation (ONLY PROVIDE WHEN SPECIFICALLY REQUESTED):\n- Housed at a large yard with other horses\n\nImportant Character Notes:\n- Initially hesitant about sharing information but cooperative once asked. Use non-technical language.`;

    const history_feedback_template = `You are an experienced veterinary educator providing feedback on a student's history-taking during this case. Focus on whether critical information was collected and give structured, actionable feedback.`;

    const owner_follow_up_template = `Role: Horse Owner (Female, worried but cooperative). ${horseName} owner is concerned and wants to know what to do next.`;

    const owner_follow_up_feedback_template = `Provide structured feedback on test prioritisation, biosecurity, and communication with the owner.`;

    const owner_diagnosis_template = `Provide advice for communicating diagnosis to the owner of ${horseName}.`;

    const get_owner_prompt_template = `You are roleplaying as ${horseName}'s owner in a veterinary consultation. Keep character and provide short, owner-appropriate responses.`;

    const get_history_feedback_prompt_template = `Provide targeted history-taking feedback when requested.`;

    const get_physical_exam_prompt_template = `You are a veterinary assistant providing physical exam findings only when asked.`;

    const get_diagnostic_prompt_template = `You are a laboratory technician providing diagnostic test results when asked.`;

    const get_owner_follow_up_prompt_template = `You are roleplaying as ${horseName}'s owner in a follow-up discussion after the physical exam.`;

    const get_owner_follow_up_feedback_prompt_template = `Provide structured feedback on the follow-up discussion.`;

    const get_owner_diagnosis_prompt_template = `You are the owner receiving a diagnosis; respond in character.`;

    const get_overall_feedback_prompt_template = `Provide comprehensive feedback on the student's performance across the case.`;

    const ensure = (key: string, value: any) => {
      if (!body[key] || String(body[key]).trim() === "") body[key] = value;
    };
    ensure("description", description_template);
    ensure("details", details_template);
    // estimated_time may be null at this point; ensure numeric
    if (!body.estimated_time || isNaN(Number(body.estimated_time))) {
      body.estimated_time = estimated_time_template;
    }
    ensure("difficulty", difficulty_template);
    ensure("physical_exam_findings", physical_exam_findings_template);
    ensure("diagnostic_findings", diagnostic_findings_template);
    ensure("owner_background", owner_background_template);
    ensure("history_feedback", history_feedback_template);
    ensure("owner_follow_up", owner_follow_up_template);
    ensure("owner_follow_up_feedback", owner_follow_up_feedback_template);
    ensure("owner_diagnosis", owner_diagnosis_template);
    ensure("get_owner_prompt", get_owner_prompt_template);
    ensure("get_history_feedback_prompt", get_history_feedback_prompt_template);
    ensure("get_physical_exam_prompt", get_physical_exam_prompt_template);
    ensure("get_diagnostic_prompt", get_diagnostic_prompt_template);
    ensure("get_owner_follow_up_prompt", get_owner_follow_up_prompt_template);
    ensure(
      "get_owner_follow_up_feedback_prompt",
      get_owner_follow_up_feedback_prompt_template
    );
    ensure("get_owner_diagnosis_prompt", get_owner_diagnosis_prompt_template);
    ensure("get_overall_feedback_prompt", get_overall_feedback_prompt_template);

    // Insert into Supabase and request the inserted row(s) back
    // using .select() so the response contains the inserted record instead of null.
    const { data, error } = await supabase
      .from("cases")
      .insert([body])
      .select();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
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
  try {
    const body = await req.json();
    if (!body || !body.id) {
      return NextResponse.json(
        { error: "id is required for update" },
        { status: 400 }
      );
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
