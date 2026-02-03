import { normalizeRoleKey } from "@/features/avatar/utils/role-utils";

export const ALLOWED_CHAT_PERSONA_KEYS = ["owner", "veterinary-nurse"] as const;

export type AllowedChatPersonaKey = (typeof ALLOWED_CHAT_PERSONA_KEYS)[number];

const allowedPersonaSet = new Set<string>(ALLOWED_CHAT_PERSONA_KEYS);
const OWNER_HINTS = ["owner", "client", "producer", "farmer", "guardian"];
const NURSE_HINTS = ["nurse", "technician", "tech", "assistant", "staff"];

export function isAllowedChatPersonaKey(value?: string | null): value is AllowedChatPersonaKey {
  if (!value) return false;
  return allowedPersonaSet.has(value);
}

function classifyByHint(label: string): AllowedChatPersonaKey | null {
  const lower = label.toLowerCase();
  if (NURSE_HINTS.some((hint) => lower.includes(hint))) {
    return "veterinary-nurse";
  }
  if (OWNER_HINTS.some((hint) => lower.includes(hint))) {
    return "owner";
  }
  return null;
}

export function classifyChatPersonaLabel(label?: string | null): AllowedChatPersonaKey | null {
  if (!label) return null;
  const trimmed = label.trim();
  if (!trimmed) return null;

  const hinted = classifyByHint(trimmed);
  if (hinted) {
    return hinted;
  }

  const normalized = normalizeRoleKey(trimmed);
  if (normalized && allowedPersonaSet.has(normalized)) {
    return normalized as AllowedChatPersonaKey;
  }

  return null;
}

export function resolveChatPersonaRoleKey(stageRole?: string | null, displayRole?: string | null): AllowedChatPersonaKey {
  // Enforce strict stage-to-persona mapping when the stage title clearly
  // indicates which participant should answer. This prevents accidental
  // classification when stage names include participant words.
  const s = stageRole ?? "";
  const lower = s.toLowerCase();

  // Stage -> persona mapping based on the workflow:
  // - History Taking -> owner
  // - Physical Examination -> veterinary-nurse
  // - Diagnostic Planning -> owner
  // - Laboratory & Tests -> veterinary-nurse
  // - Treatment Plan -> veterinary-nurse
  // - Client Communication -> owner
  if (/history/i.test(s) || /history taking/i.test(s)) return "owner";
  if (/physical/i.test(s) || /physical examination/i.test(s)) return "veterinary-nurse";
  if (/diagnostic/i.test(s) && /planning/i.test(s)) return "owner";
  if (/laboratory|lab|tests|test/i.test(s)) return "veterinary-nurse";
  if (/treatment/i.test(s) && /plan/i.test(s)) return "veterinary-nurse";
  if (/client communication/i.test(s) || /client communication/i.test(lower) || /communication/i.test(s)) return "owner";

  // Fallbacks: prefer the explicit `stageRole` when available (to honor
  // stage-level intent), otherwise prefer an explicit persona `displayRole`,
  // then classify from the stageRole or default to nurse.
  return classifyChatPersonaLabel(stageRole) ?? classifyChatPersonaLabel(displayRole) ?? classifyChatPersonaLabel(stageRole) ?? "veterinary-nurse";
}
