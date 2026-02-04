import type { Message } from "@/features/chat/models/chat";
import type { Stage } from "@/features/stages/types";
import { parseRequestedKeys } from "@/features/chat/services/physFinder";

export function transformNurseAssistantMessage(
  aiMessage: Message,
  stage: Stage | undefined,
  lastUserText: string | undefined,
  messages: Message[] = [],
): { message: Message; allowTts: boolean } {
  try {
    const personaKey = aiMessage.personaRoleKey ?? "";
    const roleLower = (stage?.role ?? "").toLowerCase();
    const stageTitle = (stage?.title ?? "").toLowerCase();
    const isSensitiveStage =
      /physical|laboratory|lab|treatment/.test(stageTitle) ||
      /nurse|lab|laboratory/.test(roleLower);
    const isNursePersona =
      personaKey === "veterinary-nurse" ||
      /nurse|lab/.test(personaKey || roleLower);
    if (!isSensitiveStage || !isNursePersona)
      return { message: aiMessage, allowTts: true };

    // Prefer explicit lastUserText, but fall back to the most recent
    // user message from conversation state if not provided.
    let lastUser = String(lastUserText ?? "").trim();
    if (!lastUser) {
      try {
        const lastUserMsg = [...messages]
          .reverse()
          .find((m) => m.role === "user");
        lastUser = String(lastUserMsg?.content ?? "").trim();
      } catch (e) {
        lastUser = "";
      }
    }
    const requested = parseRequestedKeys(lastUser || "");
    // If the user explicitly requested specific canonical keys, allow normal flow
    if (
      requested &&
      Array.isArray(requested.canonical) &&
      requested.canonical.length > 0
    ) {
      return { message: aiMessage, allowTts: true };
    }

    // If the assistant content is short/simple, allow it. Also map terse 'Not documented' replies
    // to a more helpful human-friendly phrasing. However, if the content looks like a
    // findings dump (pipes or parameter indicators), treat it as a dump regardless of length.
    const content = String(aiMessage.content ?? "").trim();
    const findingsIndicators =
      /(temperature|temp\b|heart rate|pulse|respiratory rate|rr\b|hr\b|blood pressure|vitals|respirations)/i;
    const looksLikeDumpEarly =
      (content.match(/\|/g) || []).length >= 2 ||
      findingsIndicators.test(content);
    if (!content || (content.length < 180 && !looksLikeDumpEarly)) {
      try {
        const normalizedShort = content.toLowerCase().trim();
        if (
          normalizedShort === "not documented." ||
          normalizedShort === "not documented" ||
          /:\s*not documented$/i.test(content)
        ) {
          const friendly =
            "I don't see that recorded; it may be pending or not yet run. I can request the test and you'll see results in the Lab stage.";
          const replaced: Message = { ...aiMessage, content: friendly };
          return { message: replaced, allowTts: true };
        }
      } catch {}
      return { message: aiMessage, allowTts: true };
    }

    // Heuristics: if content contains multiple parameter indicators or pipe separators,
    // treat as a findings dump and suppress it in favor of a clarifying prompt.
    const findingsIndicators2 = findingsIndicators; // reuse the earlier regex for clarity
    const looksLikeDump =
      looksLikeDumpEarly ||
      (content.match(/\|/g) || []).length >= 2 ||
      findingsIndicators2.test(content);
    if (!looksLikeDump) return { message: aiMessage, allowTts: true };

    const clarifying =
      "I can provide specific physical findings if you request them. Which parameters would you like (for example: 'hr, rr, temperature')?";
    const replaced: Message = { ...aiMessage, content: clarifying };
    return { message: replaced, allowTts: false };
  } catch (e) {
    return { message: aiMessage, allowTts: true };
  }
}
