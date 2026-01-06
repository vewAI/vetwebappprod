import OpenAi from "openai";
import { NextRequest, NextResponse } from "next/server";
import { getRoleInfoPrompt } from "@/features/role-info/services/roleInfoService";
import { getStagesForCase } from "@/features/stages/services/stageService";
import { resolveChatPersonaRoleKey } from "@/features/chat/utils/persona-guardrails";
import {
  buildPersonaSeeds,
  buildSharedPersonaSeeds,
} from "@/features/personas/services/personaSeedService";
import type {
  PersonaIdentity,
  PersonaSeed,
} from "@/features/personas/models/persona";
import { CHAT_SYSTEM_GUIDELINE } from "@/features/chat/prompts/systemGuideline";
import { resolvePromptValue } from "@/features/prompts/services/promptService";
import { ensureCasePersonas } from "@/features/personas/services/casePersonaPersistence";
import { ensureSharedPersonas } from "@/features/personas/services/globalPersonaPersistence";
import { requireUser } from "@/app/api/_lib/auth";
import {
  normalizeCaseMedia,
  type CaseMediaItem,
} from "@/features/cases/models/caseMedia";
import { searchMerckManual } from "@/features/external-resources/services/merckService";
import { debugEventBus } from "@/lib/debug-events-fixed";

const openai = new OpenAi({
  apiKey: process.env.OPENAI_API_KEY,
});

const stripLeadingPersonaIntro = (
  text: string | null | undefined,
  labels: Array<string | undefined>
): string => {
  if (!text) {
    return "";
  }

  const uniqueLabels = Array.from(
    new Set(
      labels
        .map((label) => (label ? label.trim() : ""))
        .filter((label) => label.length > 0)
    )
  );

  let output = text;

  for (const label of uniqueLabels) {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(
      `^\\s*(?:${escaped})(?:\\s*\\([^)]*\\))?\\s*:\\s*`,
      "i"
    );
    if (pattern.test(output)) {
      output = output.replace(pattern, "");
      break;
    }
  }

  return output.trimStart();
};

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if ("error" in auth) {
    return auth.error;
  }
  const { supabase } = auth;
  try {
    const { messages, stageIndex, caseId, attemptId } = await request.json();

    // Validate that messages is an array
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Messages array is required" },
        { status: 400 }
      );
    }

    const lastUserMessage = [...messages]
      .reverse()
      .find((msg) => msg.role === "user");
    const enhancedMessages = [...messages];

    // Parallel Fetching: Start both RAG and DB lookups immediately
    const ragPromise = (async () => {
      let ragContext = "";
      if (caseId && lastUserMessage) {
        try {
          // Generate embedding
          const embeddingResp = await openai.embeddings.create({
            model: "text-embedding-3-small",
            input: lastUserMessage.content.replace(/\n/g, " "),
          });
          const embedding = embeddingResp.data[0].embedding;

          // Search knowledge
          const { data: knowledgeChunks, error: ragError } = await supabase.rpc("match_case_knowledge", {
            query_embedding: embedding,
            match_threshold: 0.75,
            match_count: 5, // Increased to accommodate both case data and papers
            filter_case_id: caseId,
          });

          if (ragError) {
            console.warn("RAG RPC failed:", ragError);
          } else if (knowledgeChunks && knowledgeChunks.length > 0) {
            // Separate case data from scientific papers
            const caseDataChunks = knowledgeChunks.filter(
              (k: any) => k.metadata?.source === "CASE_DATA"
            );
            const paperChunks = knowledgeChunks.filter(
              (k: any) => k.metadata?.source !== "CASE_DATA"
            );

            // Build context with clear separation
            if (caseDataChunks.length > 0) {
              const caseDataList = caseDataChunks
                .map((k: any) => k.content)
                .join("\n\n");

              ragContext += `CASE FACTS (from database):\nThe following information is stored in the case database. Use this as definitive facts about the patient and case:\n\n${caseDataList}\n\n`;
            }

            if (paperChunks.length > 0) {
              const paperList = paperChunks
                .map((k: any) => `[Source: ${k.metadata?.source ?? "Unknown"}]\n${k.content}`)
                .join("\n\n");

              ragContext += `SCIENTIFIC REFERENCES (uploaded papers):\nThe following materials have been uploaded specifically for this case. Use these for deep scientific knowledge, research protocols, and specific medical reference values:\n\n${paperList}`;
            }

            // Debug event
            try {
              debugEventBus.emitEvent('info', 'RAG', 'Knowledge retrieved', {
                caseDataChunks: caseDataChunks.length,
                paperChunks: paperChunks.length,
                total: knowledgeChunks.length,
              });
            } catch { }
          }
        } catch (err) {
          console.warn("RAG logic error:", err);
        }
      }
      return ragContext;
    })();

    const dbPromise = (async () => {
      let ownerInfo: string | null = null;
      let timepointInfo: string | null = null;
      let dbRecord: Record<string, unknown> | null = null;
      let mediaItems: CaseMediaItem[] = [];

      if (caseId) {
        try {
          const { data: caseRow, error: caseErr } = await supabase
            .from("cases")
            .select("*")
            .eq("id", caseId)
            .maybeSingle();

          if (caseErr) {
            console.warn("Could not fetch case:", caseErr.message);
          } else if (caseRow) {
            dbRecord = caseRow as Record<string, unknown>;
            const rawMedia = (caseRow as { media?: unknown }).media;
            mediaItems = normalizeCaseMedia(rawMedia);

            if (caseRow.owner_background) {
              ownerInfo = String(caseRow.owner_background);
              const replacement = "the owner";
              ownerInfo = ownerInfo.replace(/\[Your Name\]/g, replacement);
              ownerInfo = ownerInfo.replace(/\{owner_name\}/g, replacement);
            }
          }

          if (typeof stageIndex === "number") {
            const { data: timepoint } = await supabase
              .from("case_timepoints")
              .select("stage_prompt, label")
              .eq("case_id", caseId)
              .eq("sequence_index", stageIndex)
              .maybeSingle();

            if (timepoint?.stage_prompt) {
              timepointInfo = `CURRENT TIME: ${timepoint.label}\nCONTEXT UPDATE: ${timepoint.stage_prompt}`;
            }
          }
        } catch (e) {
          console.warn("Error fetching DB data for caseId", caseId, e);
        }
      }
      return { ownerInfo, timepointInfo, dbRecord, mediaItems };
    })();

    // Await both independent chains
    const [ragContext, dbResult] = await Promise.all([ragPromise, dbPromise]);

    // Deconstruct DB results.
    let { ownerInfo: ownerBackground, timepointInfo: timepointPrompt, dbRecord: caseRecord, mediaItems: caseMedia } = dbResult;

    if (!caseId) {
      console.warn("No caseId provided");
    }

    if (ragContext) {
      enhancedMessages.unshift({
        role: "system",
        content: ragContext
      });
    }

    // Role Info Prompt logic (restored and correctly scoped)
    let roleInfoPromptContent: string | null = null;
    if (caseId && stageIndex !== undefined && lastUserMessage) {
      const roleInfoPrompt = await getRoleInfoPrompt(
        caseId,
        stageIndex,
        lastUserMessage.content
      );

      if (roleInfoPrompt) {
        roleInfoPromptContent = roleInfoPrompt;
      }
    }



    let displayRole: string | undefined = undefined;
    let stageRole: string | undefined = undefined;
    let stageDescriptor: { id?: string; title?: string; role?: string } | null = null;
    let personaRoleKey: string | undefined = undefined;
    let personaIdentity: PersonaIdentity | undefined = undefined;
    if (caseId && typeof stageIndex === "number") {
      try {
        const stages = getStagesForCase(caseId);
        const stage = stages && stages[stageIndex];
        if (stage) {
          stageDescriptor = {
            id: stage.id,
            title: stage.title,
            role: stage.role,
          };
        }
        if (stage && stage.role) {
          stageRole = stage.role;
          if (/owner|client/i.test(stage.role) && ownerBackground) {
            const roleMatch = ownerBackground.match(/Role:\s*(.+)/i);
            if (roleMatch && roleMatch[1]) {
              displayRole = roleMatch[1].trim();
            } else {
              const horseMatch = ownerBackground.match(/Horse:\s*([^\n]+)/i);
              if (horseMatch && horseMatch[1]) {
                const horseName = horseMatch[1].split("(")[0].trim();
                displayRole = `Owner (${horseName})`;
              } else {
                displayRole = stage.role;
              }
            }
          } else {
            displayRole = stage.role;
          }
        }
      } catch (stageErr) {
        console.warn("Failed to resolve stage role for case", caseId, stageErr);
      }
    }

    if (!displayRole && ownerBackground) {
      const roleMatch = ownerBackground.match(/Role:\s*(.+)/i);
      if (roleMatch && roleMatch[1]) {
        displayRole = roleMatch[1].trim();
      } else {
        const horseMatch = ownerBackground.match(/Horse:\s*([^\n]+)/i);
        if (horseMatch && horseMatch[1]) {
          const horseName = horseMatch[1].split("(")[0].trim();
          displayRole = `Owner (${horseName})`;
        } else {
          displayRole = "Client (Owner)";
        }
      }
    }

    personaRoleKey = resolveChatPersonaRoleKey(stageRole, displayRole);

    // Enforce on_demand findings release after persona resolution so we know
    // which persona is answering. If the case is configured for 'on_demand'
    // release and the student asked a general findings/results question,
    // return a clarifying prompt instead of releasing all findings.
    try {
      const strategy = caseRecord && typeof caseRecord === 'object' ? (caseRecord as any)["findings_release_strategy"] : undefined;
      const isOnDemand = strategy === 'on_demand';
      const q = lastUserMessage?.content ?? "";
      const looksLikeGeneralFindingsRequest = /\b(findings|vitals|results|diagnostic results|test results)\b/i.test(q) || /what\b.*\b(findings|results|vitals)\b/i.test(q) || /show\b.*\b(findings|results|vitals)\b/i.test(q);
      const personaIsNurseOrLab = Boolean(personaRoleKey && (personaRoleKey === 'veterinary-nurse' || personaRoleKey === 'lab-technician')) || Boolean(stageDescriptor && /nurse|laboratory|lab/i.test(String(stageDescriptor.role ?? '')));
      if (isOnDemand && looksLikeGeneralFindingsRequest && personaIsNurseOrLab) {
        const clarifying = "Please request a specific finding or system (for example: 'vitals', 'cardiovascular exam', 'CBC'). Which would you like to see?";
        try { debugEventBus.emitEvent('info','ChatDBMatch','on_demand-clarify',{ caseId, q }); } catch {}
        return NextResponse.json({
          content: clarifying,
          displayRole: displayRole,
          portraitUrl: undefined,
          voiceId: undefined,
          personaSex: undefined,
          personaRoleKey: personaRoleKey ?? undefined,
        });
      }
    } catch (e) {
      console.warn('Error enforcing on_demand findings guard', e);
    }

    // Filter media relevant to the current stage
    const stageTokens = new Set<string>();
    const pushToken = (set: Set<string>, value?: string | null) => {
      if (!value) return;
      const token = value.toString().trim().toLowerCase();
      if (token) {
        set.add(token);
      }
    };

    if (stageDescriptor) {
      pushToken(stageTokens, stageDescriptor.id);
      pushToken(stageTokens, stageDescriptor.title);
      pushToken(stageTokens, stageDescriptor.role);
    }
    pushToken(stageTokens, stageRole);
    pushToken(stageTokens, displayRole);
    pushToken(stageTokens, personaRoleKey);

    const relevantMedia = caseMedia.filter((item) => {
      const stageRef = item.stage ?? {};
      const refTokens = new Set<string>();
      pushToken(refTokens, stageRef.stageId);
      pushToken(refTokens, stageRef.stageKey);
      pushToken(refTokens, stageRef.roleKey);

      // If no stage reference, it's global/available to all
      if (!refTokens.size) {
        return true;
      }

      // Otherwise, must match at least one token from current stage
      for (const token of refTokens) {
        if (stageTokens.has(token)) {
          return true;
        }
      }
      return false;
    });

    if (relevantMedia.length > 0) {
      const mediaList = relevantMedia
        .map(
          (m) =>
            `- [MEDIA:${m.id}] ${m.type.toUpperCase()} [${m.trigger === "auto" ? "AUTO-SHOW" : "ON-DEMAND"
            }]: ${m.caption || "No description"}`
        )
        .join("\n");

      const mediaPrompt = `
You have access to the following medical records and diagnostics.
- Items marked [AUTO-SHOW] MUST be presented IMMEDIATELY in your very first response for this stage. Do not ask the user if they want to see it. Just show it.
- Items marked [ON-DEMAND] should ONLY be shown if the student explicitly asks for them.

Available Media:
${mediaList}

CRITICAL INSTRUCTION:
To show a media item, you MUST include its tag (e.g. [MEDIA:123]) in your response text.
If an item is marked [AUTO-SHOW], you MUST include its tag (e.g. [MEDIA:123]) at the start of your response.
If you are listing diagnostic results (like bloodwork or ultrasound), you MUST include the corresponding [MEDIA:ID] tag if one exists.
DO NOT generate markdown image links (like ![alt](url)) or text descriptions of URLs. ONLY use the [MEDIA:ID] tag.
`;
      enhancedMessages.unshift({ role: "system", content: mediaPrompt });
    }

    // Unshift role info and owner background AFTER media prompt
    // This results in the array order: [owner, role, media]
    // Because unshift adds to the front:
    // 1. Media -> [media]
    // 2. Role -> [role, media]
    // 3. Owner -> [owner, role, media]
    // This ensures Media instructions (like [AUTO-SHOW]) appear LAST in the system messages,
    // giving them higher priority/recency than the Role instructions.

    if (timepointPrompt) {
      enhancedMessages.unshift({ role: "system", content: timepointPrompt });
    }

    if (roleInfoPromptContent) {
      enhancedMessages.unshift({ role: "system", content: roleInfoPromptContent });
    }

    if (ownerBackground) {
      enhancedMessages.unshift({ role: "system", content: ownerBackground });
    }

    type PersonaTableRow = {
      role_key?: string | null;
      display_name?: string | null;
      behavior_prompt?: string | null;
      metadata?: unknown;
      image_url?: string | null;
      status?: string | null;
    };

    let personaRow: PersonaTableRow | null = null;
    let personaMetadata: Record<string, unknown> | null = null;
    let personaImageUrl: string | undefined = undefined;
    let personaBehaviorPrompt: string | undefined = undefined;
    let personaSeeds: PersonaSeed[] | null = null;

    const useCasePersona =
      personaRoleKey &&
      typeof caseId === "string" &&
      (personaRoleKey === "owner" || personaRoleKey === "veterinary-nurse");

    if (useCasePersona && caseId) {
      try {
        const { data: row, error } = await supabase
          .from("case_personas")
          .select(
            "role_key, display_name, behavior_prompt, metadata, image_url, status"
          )
          .eq("case_id", caseId)
          .eq("role_key", personaRoleKey)
          .maybeSingle();

        if (error) {
          console.warn("Failed to read persona row for chat", error);
        } else if (row) {
          personaRow = row as PersonaTableRow;
        }

        if (!personaRow && caseRecord) {
          try {
            await ensureCasePersonas(
              supabase,
              caseId,
              caseRecord as Record<string, unknown>
            );
          } catch (personaEnsureError) {
            console.warn(
              "Unable to ensure persona rows during chat request",
              personaEnsureError
            );
          }
          const { data: retryRow } = await supabase
            .from("case_personas")
            .select(
              "role_key, display_name, behavior_prompt, metadata, image_url, status"
            )
            .eq("case_id", caseId)
            .eq("role_key", personaRoleKey)
            .maybeSingle();
          if (retryRow) {
            personaRow = retryRow as PersonaTableRow;
          }
        }
      } catch (personaErr) {
        console.warn("Failed to ensure persona row for chat", personaErr);
      }

      if (!personaRow && personaRoleKey) {
        try {
          await ensureSharedPersonas(supabase);
          const { data: fallbackRow } = await supabase
            .from("global_personas")
            .select(
              "role_key, display_name, behavior_prompt, metadata, image_url, status"
            )
            .eq("role_key", personaRoleKey)
            .maybeSingle();
          if (fallbackRow) {
            personaRow = fallbackRow as PersonaTableRow;
          }
        } catch (fallbackErr) {
          console.warn("Failed to fallback to shared persona row", fallbackErr);
        }
      }
    } else if (personaRoleKey) {
      try {
        await ensureSharedPersonas(supabase);
        const { data: globalRow, error: globalError } = await supabase
          .from("global_personas")
          .select(
            "role_key, display_name, behavior_prompt, metadata, image_url, status"
          )
          .eq("role_key", personaRoleKey)
          .maybeSingle();

        if (globalError) {
          console.warn("Failed to read shared persona row for chat", globalError);
        } else if (globalRow) {
          personaRow = globalRow as PersonaTableRow;
        }
      } catch (sharedErr) {
        console.warn("Failed to ensure shared persona row for chat", sharedErr);
      }
    }

    if (personaRow?.display_name) {
      displayRole = personaRow.display_name;
    }

    if (
      personaRow?.metadata &&
      typeof personaRow.metadata === "object" &&
      !Array.isArray(personaRow.metadata)
    ) {
      personaMetadata = personaRow.metadata as Record<string, unknown>;
    }

    if (!personaBehaviorPrompt && personaMetadata) {
      const behaviorCandidate = personaMetadata["behaviorPrompt"];
      if (typeof behaviorCandidate === "string") {
        const trimmedBehavior = behaviorCandidate.trim();
        if (trimmedBehavior) {
          personaBehaviorPrompt = trimmedBehavior;
        }
      }
    }

    if (!personaIdentity && personaMetadata) {
      const identityCandidate = personaMetadata["identity"];
      if (
        identityCandidate &&
        typeof identityCandidate === "object" &&
        identityCandidate !== null
      ) {
        personaIdentity = identityCandidate as PersonaIdentity;
      }
    }

    personaImageUrl = personaRow?.image_url ?? undefined;
    if (personaRow?.behavior_prompt && typeof personaRow.behavior_prompt === "string") {
      const trimmedBehavior = personaRow.behavior_prompt.trim();
      if (trimmedBehavior) {
        personaBehaviorPrompt = trimmedBehavior;
      }
    }

    let personaVoiceId: string | undefined = undefined;
    let personaSex: string | undefined = undefined;

    const resolveVoiceFromMetadata = (
      metadata: Record<string, unknown>
    ): string | undefined => {
      const direct = metadata["voiceId"];
      if (typeof direct === "string" && direct.trim()) return direct;
      const identityVoice =
        metadata["identity"] &&
          typeof metadata["identity"] === "object" &&
          metadata["identity"] !== null
          ? (metadata["identity"] as { voiceId?: unknown }).voiceId
          : undefined;
      if (typeof identityVoice === "string" && identityVoice.trim()) {
        return identityVoice;
      }
      return undefined;
    };

    const resolveSexFromMetadata = (
      metadata: Record<string, unknown>
    ): string | undefined => {
      const direct = metadata["sex"];
      if (direct === "male" || direct === "female") {
        return direct;
      }
      const identitySex =
        metadata["identity"] &&
          typeof metadata["identity"] === "object" &&
          metadata["identity"] !== null
          ? (metadata["identity"] as { sex?: unknown }).sex
          : undefined;
      if (identitySex === "male" || identitySex === "female") {
        return identitySex;
      }
      return undefined;
    };

    if (personaMetadata) {
      personaVoiceId = resolveVoiceFromMetadata(personaMetadata);
      personaSex = resolveSexFromMetadata(personaMetadata);
    }

    if (personaRoleKey) {
      try {
        if (!personaSeeds) {
          if (personaRoleKey === "owner" && caseId && typeof caseId === "string") {
            personaSeeds = buildPersonaSeeds(
              caseId,
              (caseRecord ?? {}) as Record<string, unknown>
            );
          } else {
            personaSeeds = buildSharedPersonaSeeds();
          }
        }
        const matchedSeed = personaSeeds.find(
          (seed) => seed.roleKey === personaRoleKey
        );

        if (!personaBehaviorPrompt && matchedSeed?.behaviorPrompt) {
          const trimmedBehavior = matchedSeed.behaviorPrompt.trim();
          if (trimmedBehavior) {
            personaBehaviorPrompt = trimmedBehavior;
          }
        }

        if (!personaIdentity) {
          const metadata = matchedSeed?.metadata;
          if (metadata && typeof metadata === "object") {
            const identityCandidate = (metadata as { identity?: unknown }).identity;
            if (
              identityCandidate &&
              typeof identityCandidate === "object" &&
              identityCandidate !== null
            ) {
              personaIdentity = identityCandidate as PersonaIdentity;
              if (!personaVoiceId) {
                const candidateVoice =
                  (identityCandidate as { voiceId?: unknown }).voiceId;
                if (typeof candidateVoice === "string") {
                  personaVoiceId = candidateVoice;
                }
              }
              if (!personaSex) {
                const candidateSex = (identityCandidate as { sex?: unknown }).sex;
                if (candidateSex === "male" || candidateSex === "female") {
                  personaSex = candidateSex;
                }
              }
            }
          }
        }
      } catch (seedErr) {
        console.warn(
          "Failed to resolve persona seed data",
          { caseId, personaRoleKey },
          seedErr
        );
      }
    }

    // Reuse stageTokens and pushToken from earlier
    const matchingMedia = caseMedia.filter((item) => {
      const stageRef = item.stage ?? {};
      const refTokens = new Set<string>();
      pushToken(refTokens, stageRef.stageId);
      pushToken(refTokens, stageRef.stageKey);
      pushToken(refTokens, stageRef.roleKey);
      if (!refTokens.size) {
        return false;
      }
      for (const token of refTokens) {
        if (stageTokens.has(token)) {
          return true;
        }
      }
      return false;
    });

    if (
      matchingMedia.length &&
      typeof attemptId === "string" &&
      attemptId.trim() &&
      typeof caseId === "string" &&
      caseId.trim()
    ) {
      try {
        const attemptIdSafe = attemptId.trim();
        const caseIdSafe = caseId.trim();
        const artifactRows = matchingMedia.map((item) => ({
          attempt_id: attemptIdSafe,
          case_id: caseIdSafe,
          media_id: item.id,
          media_type: item.type,
          payload: {
            stageIndex,
            stageId: stageDescriptor?.id ?? null,
            stageRole: stageDescriptor?.role ?? null,
            personaRoleKey,
          },
        }));
        await supabase.from("case_attempt_artifacts").insert(artifactRows);
      } catch (artifactErr) {
        console.warn("Failed to log case media artifact", artifactErr);
      }
    }

    if (personaIdentity?.fullName) {
      const normalizedStage = stageRole?.trim().toLowerCase();
      const normalizedDisplay = displayRole?.trim().toLowerCase();
      if (!displayRole) {
        displayRole = personaIdentity.fullName;
      } else if (
        normalizedStage &&
        normalizedDisplay &&
        normalizedStage === normalizedDisplay
      ) {
        displayRole = personaIdentity.fullName;
      }
    }

    if (personaBehaviorPrompt) {
      enhancedMessages.unshift({
        role: "system",
        content: personaBehaviorPrompt,
      });
    }

    // Short-circuit rules before calling the LLM:
    // 1) During Physical Examination stage: if student asks for lab tests or imaging,
    //    instruct them that those results are available in the Laboratory & Tests stage
    //    instead of answering that they are "not recorded" here.
    // 2) During Laboratory & Tests stage: if diagnostic findings are present in the
    //    case record and the student requests a specific test/value, return the
    //    recorded value directly from the DB to avoid hallucination.
    const userText = (lastUserMessage?.content ?? "").toLowerCase();
    const physicalStageKeywords = ["physical", "physical exam", "physical examination"];

    // Synonym maps for diagnostic and physical queries. Keys are canonical tokens.
    const DIAG_SYNONYMS: Record<string, string[]> = {
      bhb: ["beta-hydroxybutyrate", "bhb", "ketone", "ketones"],
      cbc: ["cbc", "complete blood count", "haematology", "hematology"],
      chem: ["chem", "chemistry", "chemistry panel", "blood chemistry"],
      glucose: ["glucose", "blood sugar", "sugar"],
      urinalysis: ["urinalysis", "urine"],
      xray: ["x-ray", "xray", "radiograph", "radiographs"],
      ultrasound: ["ultrasound", "usg", "echography", "echo"],
      ecg: ["ecg", "ecg tracing", "ecg report"],
      calcium: ["calcium", "ca"],
    };

    const PHYS_SYNONYMS: Record<string, string[]> = {
      rumen_turnover: ["rumen turnover", "rumen_turnover", "rumen_turnover"],
      // include dash/underscore variants and common phrase forms
      rumen_turnover_alt: ["rumen-turnover", "rumen turnover", "rumen_turnover"],
      ballottement: ["ballottement", "ballottement was", "ballott"],
      temperature: ["temp", "temperature"],
      heart_rate: ["heart", "heart rate", "pulse"],
      respiratory_rate: ["respiratory", "respirations", "resp rate", "resp"] ,
      mucous_membranes: ["mucous", "mucous membrane", "mm", "mm color", "mm colour"],
      hydration: ["hydration"],
      abdomen: ["abdomen", "abdominal", "rumen"]
    };

    function normalizeForMatching(s: string): string {
      return String(s || "")
        .toLowerCase()
        .replace(/[ _\-]+/g, " ")
        .replace(/[^a-z0-9 ]+/g, "")
        .trim();
    }

    // Convert Celsius temperature mentions in free text to Fahrenheit.
    // Replace occurrences like '38.7 °C' or '38.7°C' with '101.7 °F (38.7 °C)'.
    function convertCelsiusToFahrenheitInText(s: string): string {
      if (!s || typeof s !== 'string') return s;
      try {
        return s.replace(/([-+]?\d+(?:\.\d+)?)\s*°?\s*C\b/gi, (_m, cstr) => {
          const c = parseFloat(cstr);
          if (Number.isNaN(c)) return _m;
          const f = (c * 9) / 5 + 32;
          // show Fahrenheit first (one decimal) and keep original Celsius in parens
          return `${f.toFixed(1)} °F (${c} °C)`;
        });
      } catch (e) {
        return s;
      }
    }

    function findSynonymKey(text: string, groups: Record<string, string[]>): string | null {
      const tNorm = normalizeForMatching(text);
      for (const [key, syns] of Object.entries(groups)) {
        for (const s of syns) {
          if (!s) continue;
          const sNorm = normalizeForMatching(s);
          if (sNorm && tNorm.includes(sNorm)) return key;
        }
      }
      return null;
    }

    function lineMatchesSynonym(line: string, syns: string[]): boolean {
      const lNorm = normalizeForMatching(line);
      return syns.some(s => {
        if (!s) return false;
        const sNorm = normalizeForMatching(s);
        return sNorm && lNorm.includes(sNorm);
      });
    }

    // Search across all fields of the case record (recursively) for any matches
    function searchCaseRecordForQuery(query: string, record: Record<string, unknown> | null): string[] {
      const results: string[] = [];
      if (!record) return results;
      const qNorm = normalizeForMatching(query);
      const visit = (obj: any, path = "") => {
        if (obj === null || obj === undefined) return;
        if (typeof obj === "string") {
          const vNorm = normalizeForMatching(obj as string);
          if (qNorm && vNorm.includes(qNorm)) {
            results.push(`${path}: ${obj}`);
          }
          return;
        }
        if (typeof obj === "number" || typeof obj === "boolean") {
          const vNorm = String(obj);
          if (normalizeForMatching(vNorm).includes(qNorm)) {
            results.push(`${path}: ${obj}`);
          }
          return;
        }
        if (Array.isArray(obj)) {
          for (let i = 0; i < obj.length; i++) {
            visit(obj[i], `${path}[${i}]`);
          }
          return;
        }
        if (typeof obj === "object") {
          for (const k of Object.keys(obj)) {
            const v = (obj as Record<string, unknown>)[k];
            const keyPath = path ? `${path}.${k}` : k;
            const keyNorm = normalizeForMatching(keyPath);
            if (qNorm && keyNorm.includes(qNorm)) {
              results.push(`${keyPath}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`);
            }
            visit(v, keyPath);
          }
        }
      };
      try {
        visit(record, "");
      } catch (e) {
        // swallow traversal errors
      }
      return results;
    }

    async function llmCautiousFallback(ragContext: string, userQuery: string): Promise<string | null> {
      if (!ragContext || !ragContext.trim()) return null;
      try {
        const prompt = `You are an assistant that should not hallucinate medical facts. Using ONLY the following reference context, provide a short, cautious reply to the student's request. If the requested test/result is not recorded, say so first, then if the references provide a clear, evidence-backed statement about typical/expected findings, include a single concise, hedged sentence such as "We didn't run that test but available references suggest it is within normal limits." If no evidence exists, say that no inference can be made.

REFERENCE CONTEXT:\n${ragContext}\n\nSTUDENT REQUEST:\n${userQuery}`;

        const resp = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "You are a cautious clinical assistant. Answer concisely and hedge clearly; do not invent tests or values." },
            { role: "user", content: prompt }
          ],
          temperature: 0.0,
          max_tokens: 150,
        });
        const msg = resp?.choices?.[0]?.message?.content;
        return typeof msg === "string" ? msg.trim() : null;
      } catch (e) {
        console.warn("LLM fallback failed:", e);
        return null;
      }
    }

    const stageTitle = stageDescriptor?.title ?? "";
    const isPhysicalStage = /physical/i.test(stageTitle) || physicalStageKeywords.some(k=>stageTitle.toLowerCase().includes(k));
    const isLabStage = /laboratory|lab|diagnostic/i.test(stageTitle);

    const matchedDiagKeyInUser = findSynonymKey(userText, DIAG_SYNONYMS);
    // Handle physical-stage queries regardless of diagnostic-key matches.
    // Previously this branch required a diagnostic synonym which prevented
    // physical findings (e.g. 'rumen turnover') from being detected when
    // the user asked directly. Process physical-stage requests here.
    if (isPhysicalStage) {
      const matchedKeyword = matchedDiagKeyInUser;
      try {
        debugEventBus.emitEvent('info', 'ChatDBMatch', 'Physical stage query', { userText, stageTitle, matchedDiagKeyInUser });
      } catch {}
      // If diagnostic_findings contains the requested item, be explicit that it exists
      const diagField = caseRecord && typeof caseRecord === "object" ? (caseRecord as Record<string, unknown>)["diagnostic_findings"] : null;
      const physField = caseRecord && typeof caseRecord === "object" ? (caseRecord as Record<string, unknown>)["physical_exam_findings"] : null;
      const diagText = typeof diagField === "string" ? diagField : "";
      const physText = typeof physField === "string" ? physField : "";

      // If user actually asked about something recorded in the physical exam, allow returning that.
      const matchedPhysicalKey = findSynonymKey(userText, PHYS_SYNONYMS);
      if (matchedPhysicalKey && physText) {
        const lines = physText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        // first try exact line contains the user phrase tokens
        const syns = PHYS_SYNONYMS[matchedPhysicalKey] ?? [];
        const matchingLines = lines.filter(l => lineMatchesSynonym(l, syns));
        if (matchingLines.length > 0) {
          try { debugEventBus.emitEvent('info','ChatDBMatch','line-match',{ matchedKey: matchedPhysicalKey, lines: matchingLines.length }); } catch {}
          const out = convertCelsiusToFahrenheitInText(matchingLines.join("\n"));
          return NextResponse.json({ content: out, displayRole, portraitUrl: personaImageUrl, voiceId: personaVoiceId, personaSex, personaRoleKey, media: [] });
        }
        
        // Additional robust checks: try JSON key/value lookup and fuzzy line matching
        try {
          const parsed = JSON.parse(physText);
          if (parsed && typeof parsed === 'object') {
            const normQuery = normalizeForMatching(userText);
            const hits: string[] = [];
            const visit = (obj: any, prefix = '') => {
              if (!obj || typeof obj !== 'object') return;
              for (const key of Object.keys(obj)) {
                const value = obj[key];
                const lcKey = (prefix ? `${prefix}.${key}` : key);
                const lcKeyNorm = normalizeForMatching(lcKey);
                const valueNorm = typeof value === 'string' ? normalizeForMatching(value) : '';
                if (lcKeyNorm.includes(normQuery) || valueNorm.includes(normQuery)) {
                  hits.push(`${prefix ? `${prefix}.` : ''}${key}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`);
                }
                if (typeof value === 'object') visit(value, prefix ? `${prefix}.${key}` : key);
              }
            };
            visit(parsed);
            if (hits.length > 0) {
              try { debugEventBus.emitEvent('info','ChatDBMatch','json-key-match',{ query: userText, hits: hits.length }); } catch {}
              const out = convertCelsiusToFahrenheitInText(hits.join('\n'));
              return NextResponse.json({ content: out, displayRole, portraitUrl: personaImageUrl, voiceId: personaVoiceId, personaSex, personaRoleKey, media: [] });
            }
          }
        } catch (e) {
          // not JSON, continue
        }

        // Fuzzy line match: require all query tokens to appear in a line
        const normQueryTokens = normalizeForMatching(userText).split(/\s+/).filter(Boolean);
        if (normQueryTokens.length > 0) {
          const fuzzyMatches = lines.filter(l => {
            const llNorm = normalizeForMatching(l.toLowerCase());
            return normQueryTokens.every((t: string) => llNorm.includes(t));
          });
          if (fuzzyMatches.length > 0) {
            try { debugEventBus.emitEvent('info','ChatDBMatch','fuzzy-line-match',{ tokens: normQueryTokens, matches: fuzzyMatches.length }); } catch {}
            const out = convertCelsiusToFahrenheitInText(fuzzyMatches.join('\n'));
            return NextResponse.json({ content: out, displayRole, portraitUrl: personaImageUrl, voiceId: personaVoiceId, personaSex, personaRoleKey, media: [] });
          }
        }

        // if no match in the physical-exam block, try searching the rest of the case
        const caseWideHits = searchCaseRecordForQuery(userText, caseRecord as Record<string, unknown> | null);
        if (caseWideHits.length > 0) {
          try { debugEventBus.emitEvent('info','ChatDBMatch','case-wide-hits',{ query: userText, hits: caseWideHits.length }); } catch {}
          const out = convertCelsiusToFahrenheitInText(caseWideHits.join('\n'));
          return NextResponse.json({ content: out, displayRole, portraitUrl: personaImageUrl, voiceId: personaVoiceId, personaSex, personaRoleKey, media: [] });
        }

        // Next, try synonyms across the whole case record
        const synHits: string[] = [];
        for (const syns of Object.values(PHYS_SYNONYMS)) {
          for (const s of syns) {
            if (!s) continue;
            const h = searchCaseRecordForQuery(s, caseRecord as Record<string, unknown> | null);
            if (h.length > 0) synHits.push(...h);
          }
          if (synHits.length > 0) break;
        }
        if (synHits.length > 0) {
          try { debugEventBus.emitEvent('info','ChatDBMatch','synonym-case-hits',{ query: userText, hits: synHits.length }); } catch {}
          const out = convertCelsiusToFahrenheitInText(synHits.join('\n'));
          return NextResponse.json({ content: out, displayRole, portraitUrl: personaImageUrl, voiceId: personaVoiceId, personaSex, personaRoleKey, media: [] });
        }

        // Finally, consult the RAG/LLM context for a cautious, evidence-backed statement
        try {
          const fallback = await llmCautiousFallback(ragContext, userText);
          if (fallback) {
            try { debugEventBus.emitEvent('info','ChatDBMatch','llm-fallback-used',{ query: userText }); } catch {}
            return NextResponse.json({ content: fallback, displayRole, portraitUrl: personaImageUrl, voiceId: personaVoiceId, personaSex, personaRoleKey, media: [] });
          }
        } catch (e) {
          // ignore and fall through to return raw physText
          console.warn('LLM cautious fallback failed', e);
        }

        // As last resort, return the full phys text so the student sees what's recorded
        try { debugEventBus.emitEvent('info','ChatDBMatch','return-full-phys-text',{ length: physText.length }); } catch {}
        const out = convertCelsiusToFahrenheitInText(physText);
        return NextResponse.json({ content: out, displayRole, portraitUrl: personaImageUrl, voiceId: personaVoiceId, personaSex, personaRoleKey, media: [] });
      }

      if (matchedKeyword && diagText) {
        // If diag text contains any synonym for the matched diagnostic key, fall through
        // to the default diagnostic-stage response below rather than returning the
        // previous specialized message.
        const syns = DIAG_SYNONYMS[matchedKeyword] ?? [];
      }

      const reply = `Those laboratory or imaging results are not released during the physical examination stage. Diagnostic results (bloodwork, imaging) are available in the Laboratory & Tests stage — please request them there or proceed to that stage to view the recorded results.`;
      return NextResponse.json({ content: reply, displayRole, portraitUrl: undefined, voiceId: undefined, personaSex: undefined, personaRoleKey, media: [] });
    }

    if (isLabStage && caseRecord && typeof caseRecord === "object") {
      const diag = (caseRecord as Record<string, unknown>)["diagnostic_findings"];
      if (typeof diag === "string" && diag.trim().length > 0) {
        // If user asked specifically for a test or value, try to return the matching lines
        const diagText = diag as string;
        // Find diagnostic canonical key from user text
        const matchedDiagKey = findSynonymKey(userText, DIAG_SYNONYMS);
        if (matchedDiagKey) {
          const lines = diagText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
          const syns = DIAG_SYNONYMS[matchedDiagKey] ?? [];
          const matchingLines = lines.filter(l => lineMatchesSynonym(l, syns));
          if (matchingLines.length > 0) {
            const reply = convertCelsiusToFahrenheitInText(matchingLines.join("\n"));
            return NextResponse.json({ content: reply, displayRole, portraitUrl: personaImageUrl, voiceId: personaVoiceId, personaSex, personaRoleKey, media: [] });
          }
          // fallback: if diag text contains any synonym, return full diag text
          if (syns.some(s => s && diagText.toLowerCase().includes(s))) {
            return NextResponse.json({ content: convertCelsiusToFahrenheitInText(diagText), displayRole, portraitUrl: personaImageUrl, voiceId: personaVoiceId, personaSex, personaRoleKey, media: [] });
          }
          // no matching data recorded in diagnostics -> search rest of case fields
          const caseWideHits = searchCaseRecordForQuery(userText, caseRecord as Record<string, unknown> | null);
          if (caseWideHits.length > 0) {
            return NextResponse.json({ content: caseWideHits.join('\n'), displayRole, portraitUrl: personaImageUrl, voiceId: personaVoiceId, personaSex, personaRoleKey, media: [] });
          }

          // Try synonyms across all case fields for diagnostics
          const synHits: string[] = [];
          for (const syns of Object.values(DIAG_SYNONYMS)) {
            for (const s of syns) {
              if (!s) continue;
              const h = searchCaseRecordForQuery(s, caseRecord as Record<string, unknown> | null);
              if (h.length > 0) synHits.push(...h);
            }
            if (synHits.length > 0) break;
          }
          if (synHits.length > 0) {
            return NextResponse.json({ content: synHits.join('\n'), displayRole, portraitUrl: personaImageUrl, voiceId: personaVoiceId, personaSex, personaRoleKey, media: [] });
          }

          // LLM cautious fallback using RAG context
          try {
            const fallback = await llmCautiousFallback(ragContext, userText);
            if (fallback) {
              return NextResponse.json({ content: fallback, displayRole, portraitUrl: personaImageUrl, voiceId: personaVoiceId, personaSex, personaRoleKey, media: [] });
            }
          } catch (e) {
            console.warn('LLM cautious fallback failed', e);
          }

          return NextResponse.json({ content: `That result is not available in the record.`, displayRole, portraitUrl: personaImageUrl, voiceId: personaVoiceId, personaSex, personaRoleKey, media: [] });
        }
      }
    }

    // High-priority system guideline to shape assistant tone and avoid
    // verbose, repetitive, or overly-polite filler. Keep replies natural,
    // concise, and human-like. Avoid phrases like "Thank you for asking"
    // or "What else would you like to know about X?" unless explicitly
    // requested. Do not prematurely summarize or provide full diagnostic
    // conclusions unless the student asks; when asked for a summary produce
    // a concise bulleted list or a markdown table on request.
    let systemGuideline = await resolvePromptValue(
      supabase,
      "chat.system.guideline",
      CHAT_SYSTEM_GUIDELINE
    );

    const personaNameForChat =
      (typeof displayRole === "string" && displayRole.trim() !== ""
        ? displayRole.trim()
        : undefined) ?? personaIdentity?.fullName;

    if (personaNameForChat) {
      const pronounSubject = personaIdentity?.pronouns?.subject ?? "they";
      const pronounObject =
        pronounSubject === "she"
          ? "her"
          : pronounSubject === "he"
            ? "him"
            : "them";
      systemGuideline += `

Your canonical persona name is ${personaNameForChat}. When the student asks for your name or identity, always respond using "${personaNameForChat}" and remain consistent. Refer to yourself using ${pronounSubject}/${pronounObject} pronouns and stay aligned with the role-specific perspective for ${stageRole ?? displayRole ?? "this stage"}.`;
    }

    enhancedMessages.unshift({ role: "system", content: systemGuideline });

    let response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: enhancedMessages as any[],
      temperature: 0.7,
      max_tokens: 1000,
    });

    let message = response.choices[0].message;

    const assistantRawContent = message.content ?? "";

    // Parse on-demand media tags
    let content = assistantRawContent;
    const mediaIds: string[] = [];
    const mediaRegex = /\[MEDIA:([a-zA-Z0-9-]+)\]/g;
    let match;
    while ((match = mediaRegex.exec(content)) !== null) {
      mediaIds.push(match[1]);
    }
    // Remove tags from content
    content = content.replace(mediaRegex, "").trim();

    const requestedMedia = caseMedia.filter(m => mediaIds.includes(m.id));

    const assistantContent = stripLeadingPersonaIntro(content, [
      personaNameForChat,
      displayRole,
      stageRole,
    ]);
    const portraitUrl = personaImageUrl;

    return NextResponse.json({
      content: assistantContent,
      displayRole,
      portraitUrl,
      voiceId: personaVoiceId,
      personaSex,
      personaRoleKey,
      media: requestedMedia,
    });
  } catch (error) {
    console.error("Error in chat API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
