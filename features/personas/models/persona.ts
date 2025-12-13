export type PersonaStatus = "pending" | "generating" | "ready" | "failed";

export interface PersonaRecord {
  id: string;
  caseId: string;
  roleKey: string;
  displayName: string;
  prompt: string;
  behaviorPrompt?: string;
  status: PersonaStatus;
  imageUrl?: string;
  metadata?: Record<string, unknown> | null;
  generatedBy: "system" | "manual" | string;
  lastGeneratedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  sex?: PersonaSex | null;
}

export type PersonaSex = "female" | "male" | "neutral";

export interface PersonaPronouns {
  subject: "she" | "he";
  object: "her" | "him";
  possessive: "hers" | "his";
  determiner: "her" | "his";
}

export interface PersonaIdentity {
  firstName: string;
  lastName: string;
  fullName: string;
  honorific?: string;
  sex: PersonaSex;
  pronouns: PersonaPronouns;
  voiceId: string;
}

export interface PersonaSeed {
  roleKey: string;
  displayName: string;
  prompt: string;
  behaviorPrompt: string;
  imageUrl?: string;
  metadata?: Record<string, unknown>;
  sharedPersonaKey?: string;
}

export interface PersonaSeedContext {
  caseId: string;
  title: string;
  species: string;
  patientName: string;
  ownerRoleDescription: string;
  ownerSetting: string;
  caseDifficulty: string;
  ownerName?: string;
  sharedPersonaKey?: string;
}
