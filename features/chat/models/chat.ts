export interface Message {
  id: string;
  role: string;
  content: string;
  timestamp: string;
  stageIndex?: number;
  displayRole?: string;
  // optional status for UI (pending, failed, sent)
  status?: "pending" | "failed" | "sent";
  // optional hidden content (e.g., detailed owner info withheld until requested)
  hiddenContent?: string;
}
