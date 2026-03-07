import type { CaseMediaItem } from "@/features/cases/models/caseMedia";

export interface LabResultRow {
  name: string;
  value: string;
  unit: string;
  refRange?: string;
  flag?: "low" | "high" | "critical" | null;
}

export interface LabResultPanel {
  title: string;
  subtitle?: string;
  rows: LabResultRow[];
}

export interface LabResultsPayload {
  panels: LabResultPanel[];
}

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
  // Optional structured findings blob used by nurse/lab assistant messages (e.g., { hr: 38, rr: 16 })
  structuredFindings?: Record<string, unknown>;
  // Optional structured lab payload rendered as a table card in chat UI
  labResults?: LabResultsPayload;
}
