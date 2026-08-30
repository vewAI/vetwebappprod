import { NextResponse } from "next/server";
import { marked } from "marked";
import DOMPurify from "isomorphic-dompurify";
import { createOpenAIClient } from "@/lib/llm/openaiClient";
import { getLiveFeedbackPrompt } from "@/features/role-info/db-role-info";
import { requireUser } from "@/app/api/_lib/auth";
import { authorizeAttemptAccess } from "@/app/api/_lib/authorization";
import { consumeRateLimit } from "@/app/api/_lib/rateLimit";

// Feedback/LLM calls can take >10s on OpenAI; raise the Vercel function limit.
export const maxDuration = 60;


const MAX_TRANSCRIPT_ENTRIES = 400;
const MAX_ENTRY_CHARS = 8_000;

type TranscriptEntry = {
  speaker: "user" | "persona";
  text: string;
  timestamp: number;
  roleKey?: string;
};

// Accepts both the live Message shape (role/content/timestamp/personaRoleKey)
// and the legacy TranscriptEntry shape (speaker/text/timestamp/roleKey).
type RawEntry = {
  speaker?: unknown;
  role?: unknown;
  text?: unknown;
  content?: unknown;
  timestamp?: unknown;
  roleKey?: unknown;
  personaRoleKey?: unknown;
};

function normalizeEntry(raw: RawEntry): TranscriptEntry | null {
  const speaker = raw.speaker === "user" || raw.role === "user" ? "user" : "persona";
  const text =
    typeof raw.text === "string" ? raw.text : typeof raw.content === "string" ? raw.content : "";
  if (!text.trim()) return null;
  const rawTs = raw.timestamp;
  const ts =
    typeof rawTs === "number"
      ? rawTs
      : typeof rawTs === "string" && rawTs.trim()
        ? Date.parse(rawTs)
        : NaN;
  const roleKey =
    typeof raw.roleKey === "string"
      ? raw.roleKey
      : typeof raw.personaRoleKey === "string"
        ? raw.personaRoleKey
        : undefined;
  return {
    speaker,
    text: text.slice(0, MAX_ENTRY_CHARS),
    timestamp: Number.isFinite(ts) ? ts : 0,
    roleKey,
  };
}

function personaRoleLabel(roleKey?: string): string {
  switch (roleKey) {
    case "owner":
      return "Owner";
    case "veterinary-nurse":
      return "Veterinary Nurse";
    case "lab-technician":
      return "Lab Technician";
    default:
      return "Persona";
  }
}

function formatTranscript(entries: TranscriptEntry[]): string {
  return entries
    .map((entry, i) => {
      const speaker = entry.speaker === "user" ? "Student" : personaRoleLabel(entry.roleKey);
      return `Turn ${i + 1} | ${speaker}: ${entry.text}`;
    })
    .join("\n\n");
}

export async function POST(request: Request) {
  try {
    const auth = await requireUser(request);
    if ("error" in auth) {
      return auth.error;
    }
    if (!(await consumeRateLimit(`live-feedback:${auth.user.id}`, 3, 60_000))) {
      return NextResponse.json({ error: "Too many feedback requests" }, { status: 429 });
    }
    const { supabase } = auth;
    const body = (await request.json()) as {
      caseId?: unknown;
      attemptId?: unknown;
      messages?: unknown;
      transcript?: unknown;
    };
    const caseId = typeof body.caseId === "string" && body.caseId.length <= 200 ? body.caseId : "";
    const attemptId =
      typeof body.attemptId === "string" && body.attemptId.length > 0 && body.attemptId.length <= 200
        ? body.attemptId
        : null;

    const rawEntries: unknown[] = Array.isArray(body.transcript)
      ? body.transcript
      : Array.isArray(body.messages)
        ? body.messages
        : [];

    if (!caseId || !attemptId || rawEntries.length === 0 || rawEntries.length > MAX_TRANSCRIPT_ENTRIES) {
      return NextResponse.json(
        { error: "Invalid feedback request: caseId, attemptId and 1-400 transcript entries are required" },
        { status: 400 }
      );
    }

    const entries: TranscriptEntry[] = [];
    for (const raw of rawEntries) {
      if (!raw || typeof raw !== "object") continue;
      const normalized = normalizeEntry(raw as RawEntry);
      if (normalized) entries.push(normalized);
    }

    if (entries.length === 0) {
      return NextResponse.json({
        feedback:
          "<p>Session ended with no recorded interaction. Feedback requires at least one exchange.</p>",
      });
    }

    // Ownership: the attempt must belong to the caller (or be admin) and match
    // the case. This endpoint triggers a billable OpenAI call, so it must not
    // accept arbitrary case/transcript payloads.
    const access = await authorizeAttemptAccess(
      auth.adminSupabase ?? supabase,
      attemptId,
      auth.user.id,
      auth.role,
    );
    if (access.error) {
      return NextResponse.json({ error: "Failed to verify permissions" }, { status: 500 });
    }
    if (access.notFound) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
    }
    if (!access.allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (access.attempt?.case_id && access.attempt.case_id !== caseId) {
      return NextResponse.json({ error: "Attempt does not belong to this case" }, { status: 403 });
    }

    const context = formatTranscript(entries);

    // Fetch case row for per-case prompt overrides
    let caseRow: Record<string, unknown> | null = null;
    try {
      const { data, error } = await supabase
        .from("cases")
        .select("*")
        .eq("id", caseId)
        .maybeSingle();
      if (!error && data) caseRow = data as Record<string, unknown>;
    } catch (e) {
      console.warn("Could not fetch case row for live feedback:", e);
    }

    const feedbackPrompt = getLiveFeedbackPrompt(caseRow, context);

    // Fallback when OpenAI is not configured
    if (!process.env.OPENAI_API_KEY) {
      console.warn("OPENAI_API_KEY not set; returning fallback live feedback");
      const fallback = `<p>Live session completed. Automated detailed feedback is unavailable because the AI service is not configured. Here are a few communication review points:</p><ul><li>Did you greet the owner and establish the reason for the consultation?</li><li>Did you use open questions first, then focused questions?</li><li>Did you acknowledge the owner's concerns and emotions?</li><li>Did you explain your reasoning and check understanding?</li><li>Did you communicate clearly with the veterinary nurse or team?</li></ul><p>Please enable the OpenAI API key to generate richer, tailored feedback.</p>`;
      return NextResponse.json({ feedback: fallback });
    }

    // Generate feedback via OpenAI
    let feedbackContent = "";

    let openai: Awaited<ReturnType<typeof createOpenAIClient>> | null = null;
    try {
      openai = await createOpenAIClient();
    } catch (clientErr) {
      console.error("OpenAI client creation failed for live feedback:", clientErr);
      feedbackContent =
        "Live session completed. Automated detailed feedback is currently unavailable. Please enable a valid OpenAI API key.";
    }

    if (openai) {
      try {
        const promptToSend = `${feedbackPrompt}\n\nTRANSCRIPT ROLE INTERPRETATION (STRICT):\n- "Student" is the learner being assessed.\n- "Owner" is the simulated client/patient owner.\n- "Veterinary Nurse" and "Lab Technician" are the simulated clinical team.\n- Attribute every observation to the correct speaker, and evaluate the student's communication with each role they interacted with.`;
        const response = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "system", content: promptToSend }],
          temperature: 0.7,
          max_tokens: 2000,
        });
        feedbackContent = response.choices?.[0]?.message?.content ?? "";
      } catch (aiErr) {
        console.error("OpenAI call failed for live feedback:", aiErr);
        feedbackContent =
          "Live session completed. Automated detailed feedback is currently unavailable due to an upstream error. Consider reviewing your conversation flow, questioning technique, and empathy in future sessions.";
      }
    }

    // Render markdown via `marked` and sanitize with DOMPurify so OpenAI
    // generated HTML/scripts cannot reach the client. The previous regex
    // chain had no sanitization — a prompt-injection in the LLM response
    // could land <script> tags in the DOM.
    const renderedHtml = marked.parse(feedbackContent, {
      gfm: true,
      breaks: true,
    }) as string;
    const wrappedFeedback = DOMPurify.sanitize(renderedHtml, {
      ALLOWED_TAGS: [
        "h1",
        "h2",
        "h3",
        "h4",
        "p",
        "br",
        "strong",
        "em",
        "ul",
        "ol",
        "li",
        "code",
        "pre",
        "blockquote",
      ],
      ALLOWED_ATTR: [],
    });

    return NextResponse.json({ feedback: wrappedFeedback });
  } catch (error) {
    console.error("Error generating live feedback:", error);
    return NextResponse.json(
      {
        feedback: "<p>Unable to generate feedback at this time. Please try again later.</p>",
        error: "Failed to generate feedback",
      },
      { status: 500 }
    );
  }
}
