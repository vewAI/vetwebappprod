import { normalizeRoleKey } from "@/features/avatar/utils/role-utils";

export const ALLOWED_CHAT_PERSONA_KEYS = [
  "owner",
  "veterinary-nurse",
] as const;

export type AllowedChatPersonaKey =
  (typeof ALLOWED_CHAT_PERSONA_KEYS)[number];

const allowedPersonaSet = new Set<string>(ALLOWED_CHAT_PERSONA_KEYS);
const OWNER_HINTS = ["owner", "client", "producer", "farmer", "guardian"];
const NURSE_HINTS = ["nurse", "technician", "tech", "assistant", "staff"];

export function isAllowedChatPersonaKey(
  value?: string | null
): value is AllowedChatPersonaKey {
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

export function classifyChatPersonaLabel(
  label?: string | null
): AllowedChatPersonaKey | null {
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

export function resolveChatPersonaRoleKey(
  stageRole?: string | null,
  displayRole?: string | null
): AllowedChatPersonaKey {
  return (
    classifyChatPersonaLabel(stageRole) ??
    classifyChatPersonaLabel(displayRole) ??
    "veterinary-nurse"
  );
}
