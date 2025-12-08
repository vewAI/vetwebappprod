import type {
  PersonaIdentity,
  PersonaPronouns,
  PersonaSeedContext,
  PersonaSex,
} from "@/features/personas/models/persona";
import {
  DEFAULT_NURSE_AVATAR_ID,
  DEFAULT_OWNER_AVATAR_ID,
  getNurseAvatarById,
  getOwnerAvatarById,
  NURSE_AVATARS,
  OWNER_AVATARS,
  type PersonaAvatarProfile,
} from "@/features/personas/data/avatar-profiles";

function buildPronouns(sex: PersonaSex): PersonaPronouns {
  if (sex === "male") {
    return {
      subject: "he",
      object: "him",
      possessive: "his",
      determiner: "his",
    };
  }
  return {
    subject: "she",
    object: "her",
    possessive: "hers",
    determiner: "her",
  };
}

export function resolvePersonaIdentity(
  caseId: string,
  roleKey: string,
  context?: PersonaSeedContext
): PersonaIdentity {
  if (roleKey === "owner") {
    const avatar = getOwnerAvatarById(context?.ownerAvatarKey ?? DEFAULT_OWNER_AVATAR_ID);
    return {
      firstName: avatar?.firstName ?? OWNER_AVATARS[0]?.firstName ?? "Alex",
      lastName: avatar?.lastName ?? OWNER_AVATARS[0]?.lastName ?? "Morgan",
      fullName: avatar?.displayName ?? `${OWNER_AVATARS[0]?.firstName ?? "Alex"} ${OWNER_AVATARS[0]?.lastName ?? "Morgan"}`,
      honorific: undefined,
      sex: avatar?.sex ?? "female",
      pronouns: buildPronouns(avatar?.sex ?? "female"),
      voiceId: avatar?.voiceId ?? "aria",
    };
  }

  if (roleKey === "nurse") {
    const avatar = getNurseAvatarById(context?.nurseAvatarKey ?? DEFAULT_NURSE_AVATAR_ID);
    return {
      firstName: avatar?.firstName ?? NURSE_AVATARS[0]?.firstName ?? "Riley",
      lastName: avatar?.lastName ?? NURSE_AVATARS[0]?.lastName ?? "Adams",
      fullName: avatar?.displayName ?? `${NURSE_AVATARS[0]?.firstName ?? "Riley"} ${NURSE_AVATARS[0]?.lastName ?? "Adams"}`,
      honorific: undefined,
      sex: avatar?.sex ?? "female",
      pronouns: buildPronouns(avatar?.sex ?? "female"),
      voiceId: avatar?.voiceId ?? "aria",
    };
  }

  // Fallback for unexpected role keys (should not occur with new avatar system)
  const fallback: PersonaAvatarProfile = {
    id: "fallback",
    firstName: "Alex",
    lastName: "Morgan",
    displayName: "Alex Morgan",
    sex: "female",
    voiceId: "aria",
    imageUrl: "",
  };

  return {
    firstName: fallback.firstName,
    lastName: fallback.lastName,
    fullName: fallback.displayName,
    honorific: undefined,
    sex: fallback.sex,
    pronouns: buildPronouns(fallback.sex),
    voiceId: fallback.voiceId,
  };
}
