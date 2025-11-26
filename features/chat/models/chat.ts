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
  personaRoleKey?: string;
  // optional status for UI (pending, failed, sent)
  status?: "pending" | "failed" | "sent";
}
