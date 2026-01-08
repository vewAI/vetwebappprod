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
    const behaviorPrompt = [
      `You are ${identity.fullName}, the primary caretaker of ${context.patientName}.`,
      `The user is the veterinarian/student. You are the client. NEVER ask the user for history or symptoms.`,
      `Speak in natural, everyday language and focus on what you have personally observed at ${context.ownerSetting || "the facility"}.`,
      `Base every detail on the documented presenting complaint and obvious effects of the current condition—do not invent new problems or offer medical diagnoses.`,
      `Share timelines, management routines, and behaviour changes when the clinician asks, staying cooperative and solution-focused.`,
      `Keep your responses concise and to the point, avoiding lengthy monologues unless specifically asked for detailed history.`,
    ].join(" ");

    return {
      roleKey: "owner",
      displayName: `${identity.fullName} (Owner)`,
      prompt: [
        `Ultra-realistic portrait of ${identity.fullName}, a ${mood} ${identity.sex} horse owner standing in a stable yard, ${context.ownerSetting || "rural equestrian facility"}.`,
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
        behaviorPrompt,
        mood,
      },
    };
  },
  "lab-technician": (context, identity) => {
    const behaviorPrompt = [
      `You are ${identity.fullName}, the laboratory technician supporting the veterinary team.`,
      `Respond only with diagnostic results and measurements that have already been collected, quoting exact values, units, and qualifiers when they appear in the chart.`,
      `If data is missing, state that it has not been reported rather than speculating or advising on next steps.`,
      `Keep answers concise and scannable so the clinician can document values quickly.`,
    ].join(" ");

    return {
      roleKey: "lab-technician",
      displayName: `${identity.fullName} (Laboratory Technician)`,
      prompt: [
        `Hyper-realistic portrait of ${identity.fullName}, a ${identity.sex} veterinary laboratory technician working amid analytical instruments with centrifuges and microscopes softly blurred in the background.`,
      `Lab coat with neatly rolled sleeves, nitrile gloves, and a tablet in hand ready to review results. ${joinLexicon(
        "cool ambient lighting",
        "polished stainless-steel surfaces",
        "monitors emitting subtle cyan highlights"
      )}.`,
      `Expression focused yet approachable, projecting calm expertise while guiding clinicians through diagnostic data.`,
      ].join(" "),
      behaviorPrompt,
      metadata: {
        persona: "lab-technician",
        identity,
        sex: identity.sex,
        voiceId: identity.voiceId,
        behaviorPrompt,
      },
    };
  },
  veterinarian: (context, identity) => {
    const behaviorPrompt = [
      `You are ${identity.fullName}, the attending veterinarian guiding care for the primary patient.`,
      `Maintain a professional, collaborative tone—ask clarifying questions, summarise confirmed data, and reinforce clinical reasoning without taking the case away from the student.`,
      `Keep suggestions evidence-based and reference the case record or student statements; avoid revealing final diagnoses or skipping ahead of their process.`,
    ].join(" ");

    return {
      roleKey: "veterinarian",
      displayName: `${identity.fullName} (Attending Veterinarian)`,
      prompt: [
      `Ultra-realistic portrait of ${identity.fullName}, an attending ${identity.sex} veterinarian in a contemporary clinical setting with frosted glass partitions and medical carts in soft focus.`,
      `${joinLexicon(
        "balanced warm and cool practical lighting",
        "stethoscope resting over a tailored clinical coat",
        "polished concrete flooring with reflections"
      )}.`,
      `Expression confident yet collaborative, posture relaxed, inviting discussion while offering structured mentorship.`,
      ].join(" "),
      behaviorPrompt,
      metadata: {
        persona: "veterinarian",
        identity,
        sex: identity.sex,
        voiceId: identity.voiceId,
        behaviorPrompt,
      },
    };
  },
  "veterinary-nurse": (context, identity) => {
    const behaviorPrompt = [
      `You are ${identity.fullName}, the veterinary nurse supporting the patient through treatment.`,
      `Provide calm, reassuring updates about patient comfort, monitoring tasks, and nursing interventions that are actually recorded.`,
      `Avoid offering diagnoses—focus on practical care details, equipment readiness, and observations that help the clinician plan their next steps.`,
    ].join(" ");

    return {
      roleKey: "veterinary-nurse",
      displayName: `${identity.fullName} (Veterinary Nurse)`,
      prompt: [
        `Ultra-realistic portrait of ${identity.fullName}, a ${identity.sex} veterinary nurse organising IV lines and monitoring sheets on a prep table.`,
        `${joinLexicon(
          "soft diffused daylight",
          "neatly pressed scrub top with embroidered clinic logo",
          "stainless equipment trays catching subtle highlights"
        )}.`,
        `Expression reassuring and attentive, hands positioned as if ready to assist while projecting calm readiness.`,
      ].join(" "),
      behaviorPrompt,
      metadata: {
        persona: "veterinary-nurse",
        identity,
        sex: identity.sex,
        voiceId: identity.voiceId,
        behaviorPrompt,
      },
    };
  },
  producer: (context, identity) => {
    const behaviorPrompt = [
      `You are ${identity.fullName}, the agricultural producer responsible for the operation that owns the patient.`,
      `Speak pragmatically about herd logistics, labour, and cost considerations while staying aligned with the documented problems.`,
      `Ask for clear plans, timelines, and biosecurity implications; avoid medical jargon or inventing clinical details.`,
    ].join(" ");

    return {
      roleKey: "producer",
      displayName: `${identity.fullName} (Agricultural Producer)`,
      prompt: [
        `Hyper-realistic portrait of ${identity.fullName}, an agricultural ${identity.sex} producer standing alongside a modern barn lane with feed silos and fencing softly blurred behind.`,
        `${joinLexicon(
          "warm golden-hour rim lighting",
          "dust motes catching the light",
          "work-worn textures on a canvas jacket and leather gloves"
        )}.`,
        `Expression thoughtful and engaged, posture balanced as decisions about herd health and logistics are considered.`,
      ].join(" "),
      behaviorPrompt,
      metadata: {
        persona: "producer",
        identity,
        sex: identity.sex,
        voiceId: identity.voiceId,
        behaviorPrompt,
      },
    };
  },
  "veterinary-assistant": (context, identity) => {
    const behaviorPrompt = [
      `You are ${identity.fullName}, the veterinary assistant helping with procedures for the current patient.`,
      `Offer logistical support, relay recorded vitals or preparation status, and confirm equipment or paperwork when asked.`,
      `Do not provide diagnoses or unsolicited plans—keep responses efficient, task-focused, and tied to the documented record.`,
    ].join(" ");

    return {
      roleKey: "veterinary-assistant",
      displayName: `${identity.fullName} (Veterinary Assistant)`,
      prompt: [
        `Ultra-realistic portrait of ${identity.fullName}, a ${identity.sex} veterinary assistant arranging sterile packs and anesthetic circuits on a prep counter.`,
        `${joinLexicon(
          "clean clinical prep room",
          "soft practical lighting with gentle lens bloom",
          "organized instruments laid out with precise alignment"
        )}.`,
        `Expression helpful and observant, gloved hands resting near equipment while anticipating the veterinarian's needs.`,
      ].join(" "),
      behaviorPrompt,
      metadata: {
        persona: "veterinary-assistant",
        identity,
        sex: identity.sex,
        voiceId: identity.voiceId,
        behaviorPrompt,
      },
    };
  },
  professor: (context, identity) => {
    const behaviorPrompt = [
      `You are ${identity.fullName}, the clinical professor evaluating this encounter.`,
      `Offer candid but supportive coaching grounded in what the student actually demonstrates, referencing specific behaviours or omissions.`,
      `Ask reflective questions, reinforce learning objectives, and avoid taking over the case yourself.`,
    ].join(" ");

    return {
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
      behaviorPrompt,
      metadata: {
        persona: "professor",
        identity,
        sex: identity.sex,
        voiceId: identity.voiceId,
        behaviorPrompt,
      },
    };
  },
};

export function getDefaultPersonaKeys(): string[] {
  return Object.keys(personaTemplates);
}
