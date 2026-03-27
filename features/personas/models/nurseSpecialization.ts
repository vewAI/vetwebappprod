export type NurseSkillCategory = "vitals" | "lab" | "pathology" | "symptoms" | "procedures" | "other";

export interface NurseSkill {
  name: string;
  description?: string;
  category?: NurseSkillCategory;
}

export interface NurseSpecialization {
  id: string;
  speciesKey: string; // normalized key: equine, canine, bovine, etc.
  displayName: string;
  imageUrl?: string | null;
  sex?: "female" | "male" | "neutral" | null;
  voiceId?: string | null;
  behaviorPrompt: string;
  skills: NurseSkill[];
  labReferenceRanges?: Record<string, string> | null;
  vitalReferenceRanges?: Record<string, string> | null;
  commonPathologies?: string[] | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: string;
  updatedAt?: string;
}
