import { normalizeRoleKey } from "@/features/avatar/utils/role-utils";

const OWNER_ROLE_KEYWORDS = ["owner", "client", "caretaker", "farmer"];
const NURSE_ROLE_KEYWORDS = [
  "nurse",
  "assistant",
  "technician",
  "tech",
  "lab",
  "producer",
  "professor",
  "veterinarian",
  "vet",
  "doctor",
  "mentor",
];

const HIDDEN_SHARED_ROLE_KEYWORDS = [
  "lab",
  "technician",
  "producer",
  "professor",
  "veterinarian",
  "vet",
];

function includesKeyword(value: string, keywords: string[]): boolean {
  if (!value) return false;
  return keywords.some((keyword) => value.includes(keyword));
}

export function canonicalizePersonaRole(
  rawRole?: string | null,
  displayName?: string | null
): string | null {
  const normalizedRole = normalizeRoleKey(rawRole ?? "") ?? "";
  const displayFragment = displayName ? displayName.toLowerCase() : "";
  const combined = `${normalizedRole} ${displayFragment}`.trim();

  if (combined) {
    if (includesKeyword(combined, OWNER_ROLE_KEYWORDS)) {
      return "owner";
    }
    if (includesKeyword(combined, NURSE_ROLE_KEYWORDS)) {
      return "nurse";
    }
  }

  if (normalizedRole) {
    if (includesKeyword(normalizedRole, OWNER_ROLE_KEYWORDS)) {
      return "owner";
    }
    if (includesKeyword(normalizedRole, NURSE_ROLE_KEYWORDS)) {
      return "nurse";
    }
    return normalizedRole;
  }

  if (displayFragment) {
    const normalizedDisplay = normalizeRoleKey(displayFragment) ?? "";
    if (normalizedDisplay) {
      if (includesKeyword(normalizedDisplay, OWNER_ROLE_KEYWORDS)) {
        return "owner";
      }
      if (includesKeyword(normalizedDisplay, NURSE_ROLE_KEYWORDS)) {
        return "nurse";
      }
      return normalizedDisplay;
    }
  }

  return null;
}

export function isHiddenSharedPersona(
  roleKey?: string | null,
  displayName?: string | null
): boolean {
  const normalizedRole = normalizeRoleKey(roleKey ?? "") ?? "";
  const displayFragment = displayName ? displayName.toLowerCase() : "";
  const combined = `${normalizedRole} ${displayFragment}`.trim();
  if (!combined) {
    return false;
  }
  return includesKeyword(combined, HIDDEN_SHARED_ROLE_KEYWORDS);
}
