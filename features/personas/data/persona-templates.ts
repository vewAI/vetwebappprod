import type {
  PersonaIdentity,
  PersonaSeed,
  PersonaSeedContext,
} from "@/features/personas/models/persona";

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

export const personaTemplates: PersonaTemplateMap = {
  owner: (context, identity) => {
    const mood =
      context.caseDifficulty.toLowerCase() === "hard"
        ? "concerned"
        : "attentive";

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
      metadata: {
        persona: "owner",
        identity,
        sex: identity.sex,
        voiceId: identity.voiceId,
        mood,
      },
    };
  },
  "lab-technician": (context, identity) => ({
    roleKey: "lab-technician",
    displayName: `${identity.fullName} (Laboratory Technician)`,
    prompt: [
      `Hyper-realistic portrait of ${identity.fullName}, a veterinary laboratory technician working amid analytical instruments.
The scene features modern centrifuges and microscopes softly blurred in the background.`,
      `Lab coat with neatly rolled sleeves, nitrile gloves, and a tablet in hand ready to review results. ${joinLexicon(
        "cool ambient lighting",
        "polished stainless-steel surfaces",
        "monitors emitting subtle cyan highlights"
      )}.`,
      `Expression focused yet approachable, projecting calm expertise while guiding clinicians through diagnostic data.`,
    ].join(" "),
    metadata: {
      persona: "lab-technician",
      identity,
      sex: identity.sex,
      voiceId: identity.voiceId,
    },
  }),
  veterinarian: (context, identity) => ({
    roleKey: "veterinarian",
    displayName: `${identity.fullName} (Attending Veterinarian)`,
    prompt: [
      `Ultra-realistic portrait of ${identity.fullName}, an attending veterinarian in a contemporary clinical setting with frosted glass partitions and medical carts in soft focus.`,
      `${joinLexicon(
        "balanced warm and cool practical lighting",
        "stethoscope resting over a tailored clinical coat",
        "polished concrete flooring with reflections"
      )}.`,
      `Expression confident yet collaborative, posture relaxed, inviting discussion while offering structured mentorship.`,
    ].join(" "),
    metadata: {
      persona: "veterinarian",
      identity,
      sex: identity.sex,
      voiceId: identity.voiceId,
    },
  }),
  "veterinary-nurse": (context, identity) => ({
    roleKey: "veterinary-nurse",
    displayName: `${identity.fullName} (Veterinary Nurse)`,
    prompt: [
      `Ultra-realistic portrait of ${identity.fullName}, a veterinary nurse organising IV lines and monitoring sheets on a prep table.`,
      `${joinLexicon(
        "soft diffused daylight",
        "neatly pressed scrub top with embroidered clinic logo",
        "stainless equipment trays catching subtle highlights"
      )}.`,
      `Expression reassuring and attentive, hands positioned as if ready to assist while projecting calm readiness.`,
    ].join(" "),
    metadata: {
      persona: "veterinary-nurse",
      identity,
      sex: identity.sex,
      voiceId: identity.voiceId,
    },
  }),
  producer: (context, identity) => ({
    roleKey: "producer",
    displayName: `${identity.fullName} (Agricultural Producer)`,
    prompt: [
      `Hyper-realistic portrait of ${identity.fullName}, an agricultural producer standing alongside a modern barn lane with feed silos and fencing softly blurred behind.`,
      `${joinLexicon(
        "warm golden-hour rim lighting",
        "dust motes catching the light",
        "work-worn textures on a canvas jacket and leather gloves"
      )}.`,
      `Expression thoughtful and engaged, posture balanced as decisions about herd health and logistics are considered.`,
    ].join(" "),
    metadata: {
      persona: "producer",
      identity,
      sex: identity.sex,
      voiceId: identity.voiceId,
    },
  }),
  "veterinary-assistant": (context, identity) => ({
    roleKey: "veterinary-assistant",
    displayName: `${identity.fullName} (Veterinary Assistant)`,
    prompt: [
      `Ultra-realistic portrait of ${identity.fullName}, a veterinary assistant arranging sterile packs and anesthetic circuits on a prep counter.`,
      `${joinLexicon(
        "clean clinical prep room",
        "soft practical lighting with gentle lens bloom",
        "organized instruments laid out with precise alignment"
      )}.`,
      `Expression helpful and observant, gloved hands resting near equipment while anticipating the veterinarian's needs.`,
    ].join(" "),
    metadata: {
      persona: "veterinary-assistant",
      identity,
      sex: identity.sex,
      voiceId: identity.voiceId,
    },
  }),
  professor: (context, identity) => ({
    roleKey: "professor",
    displayName: `${identity.fullName} (Clinical Professor)`,
    prompt: [
      `Ultra-realistic portrait of ${identity.fullName}, a seasoned veterinary professor within a tiered lecture theatre lined with anatomical models and etched glass panels.`,
      `Warm cinematic lighting with a soft projector glow, ${joinLexicon(
        "rows of leather-bound reference texts",
        "architectural wood panel accents"
      )}.`,
      `Professional attire with subtle veterinary insignia, expression encouraging yet evaluative while mentoring advanced learners.`,
    ].join(" "),
    metadata: {
      persona: "professor",
      identity,
      sex: identity.sex,
      voiceId: identity.voiceId,
    },
  }),
};

export function getDefaultPersonaKeys(): string[] {
  return Object.keys(personaTemplates);
}
