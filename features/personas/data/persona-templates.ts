import type {
  PersonaIdentity,
  PersonaSeed,
  PersonaSeedContext,
} from "@/features/personas/models/persona";
import {
  getNurseAvatarById,
  getOwnerAvatarById,
} from "@/features/personas/data/avatar-profiles";
import {
  PERSONA_TEMPLATE_OWNER_BEHAVIOR_DEFAULT,
  PERSONA_TEMPLATE_NURSE_BEHAVIOR_DEFAULT,
} from "@/features/prompts/defaults/personaPrompts";

type PersonaTemplate = (
  context: PersonaSeedContext,
  identity: PersonaIdentity
) => PersonaSeed;

type PersonaTemplateMap = Record<string, PersonaTemplate>;

const cinematicLexicon = [
  "shot on a Sony A7R IV with a Zeiss 85mm lens",
  "volumetric soft key light and subtle rim lighting",
  "razor-sharp focus, shallow depth of field",
  "8k UHD, photorealistic details",
];

function joinLexicon(...extra: string[]): string {
  return [...cinematicLexicon, ...extra].join(", ");
}

function renderTemplate(
  template: string,
  replacements: Record<string, string>
): string {
  let output = template;
  for (const [token, value] of Object.entries(replacements)) {
    const pattern = new RegExp(`{{\s*${token}\s*}}`, "g");
    output = output.replace(pattern, value);
  }
  // Remove any unused tokens so they do not leak into prompts
  output = output.replace(/{{\s*[A-Z0-9_]+\s*}}/g, "");
  return output.replace(/\s+/g, " ").trim();
}

export const personaTemplates: PersonaTemplateMap = {
  owner: (context, identity) => {
    const ownerAvatar = getOwnerAvatarById(context.ownerAvatarKey);
    const mood =
      context.caseDifficulty.toLowerCase() === "hard"
        ? "concerned"
        : "attentive";
    const personality =
      context.ownerPersonalityDescription ??
      ownerAvatar?.personality ??
      "calm, cooperative caretaker";
    const ownerTemplate =
      context.templateOverrides?.ownerBehaviorTemplate ??
      PERSONA_TEMPLATE_OWNER_BEHAVIOR_DEFAULT;
    const behaviorPrompt = renderTemplate(ownerTemplate, {
      FULL_NAME: identity.fullName,
      PATIENT_NAME: context.patientName,
      OWNER_SETTING: context.ownerSetting || "the facility",
      OWNER_ROLE_DESCRIPTION: context.ownerRoleDescription,
      PERSONALITY: personality,
    });

    return {
      roleKey: "owner",
      displayName: `${identity.fullName} (Owner)`,
      prompt: [
        `Ultra-realistic portrait of ${identity.fullName}, a ${mood} horse owner standing in a stable yard, ${context.ownerSetting || "rural equestrian facility"}.`,
        `The owner is described as ${context.ownerRoleDescription}. ${identity.pronouns.subject.toUpperCase()} has a poised stance that still shows how much ${identity.pronouns.subject} cares for ${context.patientName}.`,
        `Camera height at eye level, ${joinLexicon(
          "natural warm tones",
          "environmental background softly blurred"
        )}.`,
        `Wardrobe practical yet tidy, traces of the day's work visible on hands or jacket, authentic textures and nuanced expression that reflects ${identity.pronouns.determiner} connection to the horse.`,
      ].join(" "),
      behaviorPrompt,
      metadata: {
        persona: "owner",
        identity,
        sex: identity.sex,
        voiceId: identity.voiceId,
        avatarKey: ownerAvatar?.id,
        behaviorPrompt,
        mood,
        personality,
      },
      imageUrl: ownerAvatar?.imageUrl,
    };
  },
  nurse: (context, identity) => {
    const nurseAvatar = getNurseAvatarById(context.nurseAvatarKey);
    const personality =
      context.nursePersonalityDescription ??
      nurseAvatar?.personality ??
      "organized, detail-focused nurse";
    const nurseTemplate =
      context.templateOverrides?.nurseBehaviorTemplate ??
      PERSONA_TEMPLATE_NURSE_BEHAVIOR_DEFAULT;
    const behaviorPrompt = renderTemplate(nurseTemplate, {
      FULL_NAME: identity.fullName,
      PERSONALITY: personality,
      PATIENT_NAME: context.patientName,
    });

    return {
      roleKey: "nurse",
      displayName: `${identity.fullName} (Nurse)`,
      prompt: [
        `Ultra-realistic portrait of ${identity.fullName}, a veterinary nurse reviewing monitoring charts beside the patient stall.`,
        `${joinLexicon(
          "soft neutral lighting",
          "immaculate scrub top",
          "organized equipment carts in gentle focus"
        )}.`,
        `Expression attentive and calm, posture suggesting readiness to carry out the clinician's next instruction.`,
      ].join(" "),
      behaviorPrompt,
      metadata: {
        persona: "nurse",
        identity,
        sex: identity.sex,
        voiceId: identity.voiceId,
        avatarKey: nurseAvatar?.id,
        behaviorPrompt,
        personality,
      },
      imageUrl: nurseAvatar?.imageUrl,
    };
  },
};

export function getDefaultPersonaKeys(): string[] {
  return Object.keys(personaTemplates);
}
