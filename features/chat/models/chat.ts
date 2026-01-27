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
  // Optional metadata: personaRoleKey (when message was created under a persona). The server
  // resolves persona keys when responding. Do not include runtime logic in the model file.
  // optional status for UI (pending, failed, sent)
  status?: "pending" | "failed" | "sent";
  media?: CaseMediaItem[];
}
