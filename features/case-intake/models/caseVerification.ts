/**
 * One item the LLM flagged during deep verification.
 */
export interface CaseVerificationItem {
  /** Unique id for this item (uuid or sequential) */
  id: string;
  /** Which case field this relates to (e.g. "physical_exam_findings", "diagnostic_findings") */
  targetField: string;
  /** Human-readable category */
  category:
    | "physical_exam"
    | "laboratory"
    | "imaging"
    | "history"
    | "treatment"
    | "differential_diagnosis"
    | "owner_communication"
    | "biosecurity"
    | "other";
  /** Clinical item name, e.g. "Complete Blood Count (CBC)" */
  itemName: string;
  /** Clinical relevance classification */
  relevance: "mandatory" | "recommended" | "optional" | "unnecessary";
  /** Why the LLM thinks this is relevant or missing */
  reasoning: string;
  /** How often this finding/test is expected for this pathology+species+region */
  expectedFrequency: "always" | "usually" | "sometimes" | "rarely" | "never";
  /** Whether the item was already present in the uploaded case data */
  alreadyPresent: boolean;
  /** The value already in the case (if any) */
  existingValue: string;
  /** LLM's suggested value or prompt to get the value from the professor */
  suggestedPrompt: string;
  /** Professor's answer (filled during chatbot phase) */
  professorAnswer: string;
  /** Whether this item has been resolved */
  status: "pending" | "accepted" | "skipped" | "answered";
}

/**
 * Full verification result returned by the API.
 */
export interface CaseVerificationResult {
  /** Species detected */
  species: string;
  /** Condition / pathology detected */
  condition: string;
  /** Region/context if detectable */
  region: string;
  /** Summary of what was found present vs missing */
  overallAssessment: string;
  /** Completeness score 0-100 */
  completenessScore: number;
  /** All verification items, sorted by relevance then category */
  items: CaseVerificationItem[];
  /** Counts by relevance */
  counts: {
    mandatory: number;
    recommended: number;
    optional: number;
    unnecessary: number;
    alreadyPresent: number;
    missing: number;
  };
}

/**
 * A single message in the verification chatbot conversation.
 */
export interface VerificationChatMessage {
  id: string;
  role: "system" | "assistant" | "user";
  content: string;
  /** If the message is about a specific verification item */
  verificationItemId?: string;
  /** Timestamp */
  timestamp: string;
}
