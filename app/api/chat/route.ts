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
    const labRequestKeywords = ["lab", "labs", "blood", "cbc", "chem", "chemistry", "urinalysis", "urine", "ketone", "ketones", "bhb", "calcium", "electrolyte", "imaging", "x-ray", "xray", "radiograph", "radiographs", "ultrasound", "echo", "ecg", "ecg", "ecg", "ecg"];

    const stageTitle = stageDescriptor?.title ?? "";
    const isPhysicalStage = /physical/i.test(stageTitle) || physicalStageKeywords.some(k=>stageTitle.toLowerCase().includes(k));
    const isLabStage = /laboratory|lab|diagnostic/i.test(stageTitle);

    if (isPhysicalStage && labRequestKeywords.some(k => userText.includes(k))) {
      const matchedKeyword = labRequestKeywords.find(k => userText.includes(k));
      // If diagnostic_findings contains the requested item, be explicit that it exists
      const diagField = caseRecord && typeof caseRecord === "object" ? (caseRecord as Record<string, unknown>)["diagnostic_findings"] : null;
      const physField = caseRecord && typeof caseRecord === "object" ? (caseRecord as Record<string, unknown>)["physical_exam_findings"] : null;
      const diagText = typeof diagField === "string" ? diagField : "";
      const physText = typeof physField === "string" ? physField : "";

      // If user actually asked about something recorded in the physical exam, allow returning that.
      const physicalRequestKeywords = ["temp","temperature","heart","pulse","respiratory","respirations","resp","mucous","mucous membrane","mm","hydration","lymph","lymph node","ballottement","abdomen","abdominal","auscultation","palpation","mm color","mm colour","crt","capillary refill"];
      const matchedPhysical = physicalRequestKeywords.find(k => userText.includes(k));
      if (matchedPhysical && physText) {
        const lines = physText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        const matchingLines = lines.filter(l => l.toLowerCase().includes(matchedPhysical));
        if (matchingLines.length > 0) {
          return NextResponse.json({ content: matchingLines.join("\n"), displayRole, portraitUrl: personaImageUrl, voiceId: personaVoiceId, personaSex, personaRoleKey, media: [] });
        }
        // if no line match, return the full phys text so the student sees what's recorded
        return NextResponse.json({ content: physText, displayRole, portraitUrl: personaImageUrl, voiceId: personaVoiceId, personaSex, personaRoleKey, media: [] });
      }

      if (matchedKeyword && diagText) {
        // If diag text contains the matched keyword, tell the student the result exists but is released in next stage
        if (diagText.toLowerCase().includes(matchedKeyword)) {
          const reply = `That result is recorded for this case but diagnostic results are released in the Laboratory & Tests stage. Please request that item in the Laboratory & Tests stage to view the recorded value.`;
          return NextResponse.json({ content: reply, displayRole, portraitUrl: personaImageUrl, voiceId: personaVoiceId, personaSex, personaRoleKey, media: [] });
        }
      }

      const reply = `Those laboratory or imaging results are not released during the physical examination stage. Diagnostic results (bloodwork, imaging) are available in the Laboratory & Tests stage — please request them there or proceed to that stage to view the recorded results.`;
      return NextResponse.json({ content: reply, displayRole, portraitUrl: undefined, voiceId: undefined, personaSex: undefined, personaRoleKey, media: [] });
    }

    if (isLabStage && caseRecord && typeof caseRecord === "object") {
      const diag = (caseRecord as Record<string, unknown>)["diagnostic_findings"];
      if (typeof diag === "string" && diag.trim().length > 0) {
        // If user asked specifically for a test or value, try to return the matching lines
        const diagText = diag as string;
        // Look for any of the labRequestKeywords in the user text; if found, try to extract matching lines
        const matchedKeyword = labRequestKeywords.find(k => userText.includes(k));
        if (matchedKeyword) {
          const lines = diagText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
          const matchingLines = lines.filter(l => l.toLowerCase().includes(matchedKeyword));
          if (matchingLines.length > 0) {
            const reply = matchingLines.join("\n");
            return NextResponse.json({ content: reply, displayRole, portraitUrl: personaImageUrl, voiceId: personaVoiceId, personaSex, personaRoleKey, media: [] });
          }
          // fallback: if keyword not found in lines, but diag text contains the keyword anywhere, return surrounding context
          if (diagText.toLowerCase().includes(matchedKeyword)) {
            return NextResponse.json({ content: diagText, displayRole, portraitUrl: personaImageUrl, voiceId: personaVoiceId, personaSex, personaRoleKey, media: [] });
          }
          // no matching data recorded
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
