import type { CaseMediaItem } from "@/features/cases/models/caseMedia";

export interface Message {
  id: string;
  role: string;
  content: string;
  timestamp: string;
  stageIndex?: number;
  displayRole?: string;
  portraitUrl?: string;
  voiceId?: string;
  personaSex?: string;
  patientSex?: string;
  personaRoleKey?: string;
  // Prefer explicit persona selected by the client message (if present)
try {
  const explicit = (lastUserMessage as any)?.personaRoleKey;
  if (explicit && isAllowedChatPersonaKey(explicit)) {
    personaRoleKey = explicit;
    console.log(`[chat] personaRoleKey overridden by user-selected persona: ${personaRoleKey}`);
  }
} catch (e) {
  // non-blocking
}
  // optional status for UI (pending, failed, sent)
  status?: "pending" | "failed" | "sent";
  media?: CaseMediaItem[];
}
