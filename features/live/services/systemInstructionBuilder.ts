import type { Case } from "@/features/case-selection/models/case";
import type { Stage } from "@/features/stages/types";
import type { PersonaInstruction } from "../types";

type PersonaRow = {
  displayName?: string;
  portraitUrl?: string;
  sex?: string;
  behaviorPrompt?: string;
};

export function buildPersonaSystemInstruction(params: {
  caseItem: Case;
  stage: Stage;
  personaRoleKey: string;
  persona?: PersonaRow;
}): PersonaInstruction {
  const { caseItem, stage, personaRoleKey, persona } = params;

  const displayName = persona?.displayName ?? personaRoleKey;
  const roleLabel = getRoleLabel(personaRoleKey);
  const stageType = getStageType(stage);

  const patientContext = [
    `Patient: ${caseItem.species}`,
    caseItem.condition ? `Presenting complaint: ${caseItem.condition}` : "",
    `Case: ${caseItem.title}`,
  ]
    .filter(Boolean)
    .join("\n");

  const behaviorSection = persona?.behaviorPrompt
    ? `\nPERSONALITY:\n${persona.behaviorPrompt}`
    : getDefaultBehavior(personaRoleKey);

  const stageGuidance = getStageGuidance(stageType, personaRoleKey);

  const instruction = [
    `You are ${displayName}, a ${roleLabel} in a veterinary clinical simulation.`,
    "",
    "CASE CONTEXT:",
    patientContext,
    "",
    `CURRENT STAGE: ${stage.title} (${stageType})`,
    stage.description ?? "",
    "",
    stageGuidance,
    behaviorSection,
    "",
    "RULES:",
    "- Stay in character at all times — you are a real person, not an AI assistant",
    "- Respond naturally as a real person would in a clinical setting",
    "- React emotionally as your character would — worried, relieved, confused, annoyed",
    "- Keep responses conversational and concise — this is voice, not text",
    "- If the student asks about something outside your knowledge, say you don't know rather than making things up",
    "- Never break character or acknowledge that this is a simulation",
    "- Use natural speech patterns: hesitations, filler words, emotions",
  ].join("\n");

  return {
    roleKey: personaRoleKey,
    displayName,
    portraitUrl: persona?.portraitUrl,
    systemInstruction: instruction,
  };
}

function getRoleLabel(roleKey: string): string {
  const labels: Record<string, string> = {
    owner: "pet owner",
    "veterinary-nurse": "veterinary nurse",
    "lab-technician": "laboratory technician",
  };
  return labels[roleKey] ?? roleKey;
}

function getStageType(stage: Stage): string {
  const settings = stage.settings as Record<string, unknown> | undefined;
  const stageType = settings?.stage_type;
  return typeof stageType === "string" ? stageType : "custom";
}

function getStageGuidance(stageType: string, roleKey: string): string {
  const guidanceMap: Record<string, Record<string, string>> = {
    history: {
      owner: "GUIDANCE FOR THIS STAGE:\nThe student is taking your animal's history. Answer their questions about symptoms, timeline, diet, environment, and previous medical history. Be a concerned but cooperative owner. Provide information when asked, but don't volunteer everything unprompted — let the student ask the right questions.",
    },
    physical: {
      "veterinary-nurse": "GUIDANCE FOR THIS STAGE:\nThe student is performing a physical examination. You are the nurse assisting them. Provide examination findings when they ask for specific systems or observations. Be thorough and professional. Report vital signs and physical findings accurately based on the case data.",
    },
    diagnostic: {
      owner: "GUIDANCE FOR THIS STAGE:\nThe student is recommending diagnostic tests for your animal. You may be concerned about costs, worried about the procedures, or have questions. React naturally — ask about what each test involves, express concern about your animal's comfort, and discuss costs when relevant.",
    },
    laboratory: {
      "lab-technician": "GUIDANCE FOR THIS STAGE:\nThe student is requesting laboratory test results. You are the lab technician. Provide results when they ask for specific tests. Report values accurately, flag any critical values, and be professional. Guide them if they ask what tests are available.",
    },
    treatment: {
      "veterinary-nurse": "GUIDANCE FOR THIS STAGE:\nThe student is creating a treatment plan. You are the nurse who will execute it. Confirm medication orders, ask for clarification on doses if unclear, and report on the animal's response to treatment. Be thorough — double-check drug names, doses, and routes.",
    },
    communication: {
      owner: "GUIDANCE FOR THIS STAGE:\nThe student is explaining the treatment and prognosis to you. Listen carefully, ask questions a real owner would ask: Will my animal be okay? How long will recovery take? What do I need to do at home? How much will this cost? Express your emotions naturally — relief, worry, gratitude.",
    },
  };

  return guidanceMap[stageType]?.[roleKey] ?? "Respond naturally as your character would in this clinical scenario.";
}

function getDefaultBehavior(roleKey: string): string {
  const behaviors: Record<string, string> = {
    owner: "\nPERSONALITY:\nYou are a caring, concerned pet owner. You love your animal deeply and are worried about their condition. You may be anxious, emotional, or stressed. You want clear, honest answers. You may not understand medical terminology — ask for explanations in plain language when the student uses jargon.",
    "veterinary-nurse": "\nPERSONALITY:\nYou are an experienced, professional veterinary nurse. You are knowledgeable and efficient. You support the student veterinarian while maintaining clinical standards. You provide accurate observations and follow instructions carefully. You may gently prompt if something seems off.",
    "lab-technician": "\nPERSONALITY:\nYou are a detail-oriented laboratory technician. You provide precise, accurate results. You are professional and methodical. You may note which values are abnormal or critical. You don't interpret results — that's the veterinarian's job.",
  };
  return behaviors[roleKey] ?? "";
}
