import type {
  PersonaBehaviorTemplateOverrides,
  PersonaSeed,
  PersonaSeedContext,
} from "@/features/personas/models/persona";
import {
  getDefaultPersonaKeys,
  personaTemplates,
} from "@/features/personas/data/persona-templates";
import { resolvePersonaIdentity } from "@/features/personas/services/personaIdentityService";
import {
  DEFAULT_NURSE_AVATAR_ID,
  DEFAULT_OWNER_AVATAR_ID,
  getNurseAvatarById,
  getOwnerAvatarById,
} from "@/features/personas/data/avatar-profiles";

const HORSE_NAME_REGEX = /horse\s*:\s*([^\n]+)/i;
const ROLE_REGEX = /role\s*:\s*([^\n]+)/i;
const SETTING_REGEX = /(yard|stable|clinic|farm|facility)[^\n]*/i;
const BELONGS_TO_REGEX = /belongs to\s+([^,\n]+)/i;
const OWNER_LINE_REGEX = /owner\s*:\s*([^\n]+)/i;
const NAME_TOKEN_REGEX = /([A-Z][A-Za-z'\-]+)(?:\s+[A-Z][A-Za-z'\-]+)?/;

const FALLBACK_OWNER_SURNAMES = [
  "Hughes",
  "Sutton",
  "Carroll",
  "Ellis",
  "Whitaker",
  "Kavanagh",
  "Abbott",
  "Baxter",
];

export const SHARED_CASE_ID = "__global__";
export const SHARED_PERSONA_KEYS = getDefaultPersonaKeys().filter(
  (key) => key !== "owner" && key !== "nurse"
);
const SHARED_CONTEXT_BASE: PersonaSeedContext = {
  caseId: SHARED_CASE_ID,
  title: "Shared Persona Template",
  species: "Horse",
  patientName: "the patient",
  ownerRoleDescription: "a dedicated caretaker",
  ownerSetting: "the equine facility",
  caseDifficulty: "Medium",
  ownerName: undefined,
  ownerPersonalityDescription: "calm, cooperative caretaker",
  nursePersonalityDescription: "methodical veterinary nurse focused on documentation",
};

export function buildSharedPersonaSeeds(
  overrides?: PersonaBehaviorTemplateOverrides
): PersonaSeed[] {
  const seeds: PersonaSeed[] = [];

  for (const roleKey of SHARED_PERSONA_KEYS) {
    const template = personaTemplates[roleKey];
    if (!template) continue;

    const identityContext: PersonaSeedContext = {
      ...SHARED_CONTEXT_BASE,
      templateOverrides: overrides,
      sharedPersonaKey: roleKey,
      ownerAvatarKey: DEFAULT_OWNER_AVATAR_ID,
      nurseAvatarKey: DEFAULT_NURSE_AVATAR_ID,
    };
    const ownerAvatar = getOwnerAvatarById(identityContext.ownerAvatarKey);
    const nurseAvatar = getNurseAvatarById(identityContext.nurseAvatarKey);
    identityContext.ownerPersonalityDescription =
      ownerAvatar?.personality ?? identityContext.ownerPersonalityDescription;
    identityContext.nursePersonalityDescription =
      nurseAvatar?.personality ?? identityContext.nursePersonalityDescription;

    const identity = resolvePersonaIdentity(
      SHARED_CASE_ID,
      roleKey,
      identityContext
    );
    const seed = template(identityContext, identity);
    const metadata: Record<string, unknown> = {
      ...(seed.metadata ?? {}),
      identity,
      sex: identity.sex,
      voiceId: identity.voiceId,
      sharedPersonaKey: roleKey,
    };

    if (roleKey === "nurse") {
      const nurseAvatar = getNurseAvatarById(identityContext.nurseAvatarKey);
      if (nurseAvatar) {
        metadata.avatarKey = nurseAvatar.id;
        metadata.imageUrl = nurseAvatar.imageUrl;
        metadata.personality = nurseAvatar.personality;
      }
    }

    if (roleKey === "owner") {
      const ownerAvatar = getOwnerAvatarById(identityContext.ownerAvatarKey);
      if (ownerAvatar) {
        metadata.avatarKey = ownerAvatar.id;
        metadata.imageUrl = ownerAvatar.imageUrl;
        metadata.personality = ownerAvatar.personality;
      }
    }

    seeds.push({
      ...seed,
      metadata,
      sharedPersonaKey: roleKey,
    });
  }

  return seeds;
}

export function buildPersonaSeeds(
  caseId: string,
  caseBody: Record<string, unknown>,
  overrides?: PersonaBehaviorTemplateOverrides
): PersonaSeed[] {
  const baseContext = buildSeedContext(caseId, caseBody);
  const context: PersonaSeedContext = {
    ...baseContext,
    templateOverrides: overrides,
  };
  const ownerAvatar = getOwnerAvatarById(context.ownerAvatarKey);
  const nurseAvatar = getNurseAvatarById(context.nurseAvatarKey);
  const keys = getDefaultPersonaKeys();

  const seeds: PersonaSeed[] = [];

  keys.forEach((key) => {
    const template = personaTemplates[key];
    if (!template) return;
    const identityContext: PersonaSeedContext = {
      ...context,
    };
    const identity = resolvePersonaIdentity(caseId, key, identityContext);
    const seed = template(identityContext, identity);
    const mergedMetadata: Record<string, unknown> = {
      ...(seed.metadata ?? {}),
      identity,
      sex: identity.sex,
      voiceId: identity.voiceId,
    };
    if (key === "owner" && ownerAvatar) {
      mergedMetadata.avatarKey = ownerAvatar.id;
      mergedMetadata.imageUrl = ownerAvatar.imageUrl;
      mergedMetadata.personality = ownerAvatar.personality;
    }
    if (key === "nurse" && nurseAvatar) {
      mergedMetadata.avatarKey = nurseAvatar.id;
      mergedMetadata.imageUrl = nurseAvatar.imageUrl;
      mergedMetadata.personality = nurseAvatar.personality;
    }
    seeds.push({
      ...seed,
      metadata: mergedMetadata,
    });
  });

  return seeds;
}

function buildSeedContext(
  caseId: string,
  caseBody: Record<string, unknown>
): PersonaSeedContext {
  const title = safeString(caseBody["title"], `Case ${caseId}`);
  const species = safeString(caseBody["species"], "Horse");
  const ownerBackground = safeString(caseBody["owner_background"], "");
  const difficulty = safeString(caseBody["difficulty"], "Medium");
  const ownerAvatarKey = extractAvatarKey(
    caseBody["owner_avatar_key"],
    DEFAULT_OWNER_AVATAR_ID
  );
  const nurseAvatarKey = extractAvatarKey(
    caseBody["nurse_avatar_key"],
    DEFAULT_NURSE_AVATAR_ID
  );
  const ownerAvatar = getOwnerAvatarById(ownerAvatarKey);
  const nurseAvatar = getNurseAvatarById(nurseAvatarKey);

  const patientName = derivePatientName(title, ownerBackground);
  const ownerRoleDescription = deriveOwnerRole(ownerBackground);
  const ownerSetting = deriveOwnerSetting(ownerBackground);
  const ownerName = ownerAvatar?.displayName;
  const ownerPersonalityDescription = ownerAvatar?.personality;
  const nursePersonalityDescription = nurseAvatar?.personality;

  return {
    caseId,
    title,
    species,
    patientName,
    ownerRoleDescription,
    ownerSetting,
    caseDifficulty: difficulty,
    ownerName,
    ownerAvatarKey,
    nurseAvatarKey,
    ownerPersonalityDescription,
    nursePersonalityDescription,
  };
}

function extractAvatarKey(raw: unknown, fallback: string): string {
  if (typeof raw === "string" && raw.trim()) {
    return raw.trim();
  }
  return fallback;
}

function safeString(value: unknown, fallback: string): string {
  if (!value) return fallback;
  if (typeof value === "string" && value.trim()) return value.trim();
  return fallback;
}

function derivePatientName(title: string, ownerBackground: string): string {
  const titleFirstWord = title.split(/[,:-]/)[0]?.trim() ?? "Patient";

  if (ownerBackground) {
    const horseMatch = ownerBackground.match(HORSE_NAME_REGEX);
    if (horseMatch && horseMatch[1]) {
      const raw = horseMatch[1];
      const cleaned = raw.split("(")[0].trim();
      if (cleaned) return cleaned;
    }
  }

  return titleFirstWord || "Patient";
}

function deriveOwnerRole(ownerBackground: string): string {
  if (!ownerBackground) return "a caring horse owner";
  const roleMatch = ownerBackground.match(ROLE_REGEX);
  if (roleMatch && roleMatch[1]) {
    return roleMatch[1].trim();
  }
  return "a caring horse owner";
}

function deriveOwnerSetting(ownerBackground: string): string {
  if (!ownerBackground) return "at a well-kept equine facility";
  const match = ownerBackground.match(SETTING_REGEX);
  if (match && match[0]) {
    return match[0].trim();
  }
  return "at a well-kept equine facility";
}

function deriveOwnerName(
  caseBody: Record<string, unknown>,
  ownerBackground: string,
  caseId: string
): string | undefined {
  const directCaseField = extractOwnerNameFromCase(caseBody);
  if (directCaseField) {
    return sanitizeName(directCaseField, caseId);
  }

  const directField = caseBody["owner_name"];
  if (typeof directField === "string" && directField.trim()) {
    return sanitizeName(directField.trim(), caseId);
  }

  const belongsMatch = ownerBackground.match(BELONGS_TO_REGEX);
  if (belongsMatch && belongsMatch[1]) {
    return sanitizeName(belongsMatch[1].trim(), caseId);
  }

  const roleLine = ownerBackground.match(ROLE_REGEX);
  if (roleLine && roleLine[1]) {
    const candidate = roleLine[1].split(/[,(]/)[0]?.trim() ?? "";
    if (candidate && !/owner|client/i.test(candidate)) {
      return sanitizeName(candidate, caseId);
    }
  }

  const ownerLine = ownerBackground.match(OWNER_LINE_REGEX);
  if (ownerLine && ownerLine[1]) {
    const candidate = ownerLine[1].split(/[,(]/)[0]?.trim() ?? "";
    if (candidate && !/owner|client/i.test(candidate)) {
      return sanitizeName(candidate, caseId);
    }
  }

  const nameToken = ownerBackground.match(NAME_TOKEN_REGEX);
  if (nameToken && nameToken[0] && !/owner|client/i.test(nameToken[0])) {
    return sanitizeName(nameToken[0], caseId);
  }

  return undefined;
}

function extractOwnerNameFromCase(caseBody: Record<string, unknown>): string | undefined {
  const direct = caseBody["owner_name"];
  if (typeof direct === "string" && direct.trim()) {
    return direct.trim();
  }

  const aliases = ["ownerName", "clientName", "caretakerName", "client_name"];
  for (const key of aliases) {
    const candidate = caseBody[key];
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  const details = coerceRecord(caseBody["details"]);
  if (details) {
    const fromDetails = searchOwnerName(details);
    if (fromDetails) return fromDetails;
  }

  return undefined;
}

function coerceRecord(value: unknown): Record<string, unknown> | null {
  if (!value) return null;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
    return null;
  }
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function searchOwnerName(record: Record<string, unknown>): string | undefined {
  const directFields = [
    "owner_name",
    "ownerName",
    "clientName",
    "client_name",
    "caretakerName",
    "caretaker_name",
    "guardianName",
    "guardian_name",
  ];

  for (const key of directFields) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  const ownerObj = record["owner"];
  if (ownerObj && typeof ownerObj === "object" && !Array.isArray(ownerObj)) {
    const nested = searchOwnerName(ownerObj as Record<string, unknown>);
    if (nested) return nested;
  }

  return undefined;
}

function sanitizeName(raw: string, caseId: string): string {
  const cleaned = raw.replace(/[^A-Za-z'\-\s]/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return fallbackOwnerName(caseId);

  const parts = cleaned.split(" ").filter(Boolean);
  if (!parts.length) return fallbackOwnerName(caseId);
  if (parts.length === 1) {
    const lastName = pickFallbackSurname(caseId);
    return `${parts[0]} ${lastName}`;
  }
  const [first, ...rest] = parts;
  const last = rest[rest.length - 1];
  return `${first} ${last}`;
}

function fallbackOwnerName(caseId: string): string {
  const surnames = FALLBACK_OWNER_SURNAMES;
  const firstNames = ["Amelia", "Imogen", "Charlotte", "Elise", "Sofia", "Anya", "Clara", "Beatrice"];
  const firstIndex = Math.abs(hashCase(caseId)) % firstNames.length;
  const lastIndex = Math.abs(hashCase(`${caseId}:owner`)) % surnames.length;
  return `${firstNames[firstIndex]} ${surnames[lastIndex]}`;
}

function pickFallbackSurname(caseId: string): string {
  const index = Math.abs(hashCase(`${caseId}:surname`)) % FALLBACK_OWNER_SURNAMES.length;
  return FALLBACK_OWNER_SURNAMES[index];
}

function hashCase(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}
