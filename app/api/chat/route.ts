import OpenAi from "openai";
import { NextRequest, NextResponse } from "next/server";
import { getRoleInfoPrompt } from "@/features/role-info/services/roleInfoService";
import { getStagesForCase } from "@/features/stages/services/stageService";
import { resolvePersonaRoleKey } from "@/features/personas/services/personaImageService";
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

    // If we have a valid caseId, fetch owner_background and roleInfo and prepend them
    // so the LLM is influenced by the owner's personality plus any stage-specific role info.
    let ownerBackground: string | null = null;
    let caseRecord: Record<string, unknown> | null = null;
    let caseMedia: CaseMediaItem[] = [];
    if (caseId) {
      try {
        const { data: caseRow, error: caseErr } = await supabase
          .from("cases")
          // fetch the complete row so we can derive persona identities and prompts
          .select("*")
          .eq("id", caseId)
          .maybeSingle();

        if (caseErr) {
          console.warn(
            "Could not fetch case owner_background:",
            caseErr.message ?? caseErr
          );
        } else if (caseRow) {
          caseRecord = caseRow as Record<string, unknown>;
           const rawMedia = (caseRow as { media?: unknown }).media;
           caseMedia = normalizeCaseMedia(rawMedia);
          if (caseRow.owner_background) {
            ownerBackground = String(caseRow.owner_background);
            // Replace common placeholder markers the prompts may contain so the
            // LLM doesn't echo things like "[Your Name]" literally. Prefer the
            // case title (usually the horse name) when available, otherwise fall
            // back to a neutral label.
            const titleFromRow = (caseRow as { title?: string } | null)?.title;
            const replacement =
              titleFromRow && String(titleFromRow).trim() !== ""
                ? String(titleFromRow)
                : "Owner";
            ownerBackground = ownerBackground.replace(
              /\[Your Name\]/g,
              replacement
            );
            ownerBackground = ownerBackground.replace(
              /\{owner_name\}/g,
              replacement
            );
          }
        }
      } catch (e) {
        console.warn("Error fetching owner_background for caseId", caseId, e);
      }

      // Stage-specific role info
      if (stageIndex !== undefined && lastUserMessage) {
        const roleInfoPrompt = await getRoleInfoPrompt(
          caseId,
          stageIndex,
          lastUserMessage.content
        );

        if (roleInfoPrompt) {
          // Unshift role info first; ownerBackground will be unshifted after to ensure it
          // appears first in the message list (highest priority personality instruction).
          enhancedMessages.unshift({ role: "system", content: roleInfoPrompt });
        }
      }

      if (ownerBackground) {
        enhancedMessages.unshift({ role: "system", content: ownerBackground });
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

    personaRoleKey = resolvePersonaRoleKey(stageRole, displayRole) ?? undefined;

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

    if (personaRoleKey === "owner" && caseId && typeof caseId === "string") {
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

    const stageTokens = new Set<string>();
    const appendToken = (value?: string | null) => {
      if (!value) return;
      const token = value.toString().trim().toLowerCase();
      if (token) {
        stageTokens.add(token);
      }
    };
    const pushToken = (set: Set<string>, value?: string | null) => {
      if (!value) return;
      const token = value.toString().trim().toLowerCase();
      if (token) {
        set.add(token);
      }
    };
    appendToken(stageDescriptor?.id);
    appendToken(stageDescriptor?.title);
    appendToken(stageDescriptor?.role);
    appendToken(stageRole);
    appendToken(displayRole);
    appendToken(personaRoleKey);

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

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: enhancedMessages,
      temperature: 0.7,
      max_tokens: 1000,
    });

    const assistantRawContent = response.choices[0].message.content ?? "";
    const assistantContent = stripLeadingPersonaIntro(assistantRawContent, [
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
      media: matchingMedia,
    });
  } catch (error) {
    console.error("Error in chat API:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
