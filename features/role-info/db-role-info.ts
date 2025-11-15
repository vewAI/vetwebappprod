import type { RoleInfo } from "./types";

// Utility helpers to safely pull strings from the case row returned by Supabase
const getText = (
  caseRow: Record<string, unknown> | null | undefined,
  key: string,
  fallback: string
) => {
  const value = caseRow?.[key];
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }
  if (typeof value === "object" && value !== null) {
    try {
      return JSON.stringify(value, null, 2);
    } catch (error) {
      console.warn(`Failed to stringify field ${key}`, error);
    }
  }
  return fallback;
};

const getCaseTitle = (caseRow: Record<string, unknown> | null | undefined) => {
  const rawTitle =
    typeof caseRow?.title === "string" ? caseRow?.title : "the patient";
  return rawTitle.trim().length > 0 ? rawTitle : "the patient";
};

const defaultOwnerBackground = (title: string) =>
  `Role: Animal Owner (concerned but cooperative)\nPatient: ${title}\n\nProvide clear, concise answers and volunteer information only when specifically asked.`;

const defaultHistoryFeedback = `You are an experienced veterinary educator providing feedback on the student's history-taking. Highlight what they did well, the gaps that remain, and offer 2-3 concrete follow-up questions they should still ask.`;

const defaultFollowUp = (title: string) =>
  `You are the owner of ${title}. You want to understand which diagnostic tests are necessary, why they matter, how much they cost, and what to expect for your animal.`;

const defaultFollowUpFeedback = `Provide structured feedback on how the student prioritised diagnostics, explained costs/benefits, and addressed biosecurity or home-care considerations.`;

const defaultDiagnosisPrompt = (title: string) =>
  `You are the owner receiving a diagnosis and discharge plan for ${title}. Ask practical questions about monitoring, medication, prognosis, and when to seek help.`;

const defaultOverallFeedback = `Provide a concise summary of the student's strengths and areas for improvement across the entire case. Include communication, clinical reasoning, and client management.`;

export const dbRoleInfo: RoleInfo = {
  getOwnerPrompt: (
    caseRow: Record<string, unknown> | null,
    studentQuestion: string
  ) => {
    const title = getCaseTitle(caseRow);
    const ownerBackground = getText(
      caseRow,
      "owner_background",
      defaultOwnerBackground(title)
    );
    return `You are roleplaying as the owner or caretaker in a veterinary consultation. Stay in character according to the background below and only reveal information that is explicitly requested.\n\n${ownerBackground}\n\nStudent's question: ${studentQuestion}\n\nStay true to the owner personality and avoid offering diagnostic reasoning of your own.`;
  },
  getHistoryFeedbackPrompt: (
    caseRow: Record<string, unknown> | null,
    context: string
  ) => {
    const feedbackBody = getText(
      caseRow,
      "history_feedback",
      defaultHistoryFeedback
    );
    return `IMPORTANT - FIRST CHECK FOR MINIMAL INTERACTION:\n1. Determine if the student has engaged minimally (fewer than 3 substantive questions).\n2. If there is minimal interaction, give guidance instead of full feedback (encourage them to gather more history).\n3. For sufficient interaction, provide detailed feedback using the template below.\n\nConversation context:\n${context}\n\nFeedback framework:\n${feedbackBody}\n`;
  },
  getPhysicalExamPrompt: (
    caseRow: Record<string, unknown> | null,
    studentQuestion: string
  ) => {
    const findings = getText(
      caseRow,
      "physical_exam_findings",
      "Physical examination was within normal limits."
    );
    return `You are a veterinary nurse/technician assisting with the physical examination. Provide ONLY the findings that the student specifically requests.\n\nAvailable findings:\n${findings}\n\nStudent request: ${studentQuestion}`;
  },
  getDiagnosticPrompt: (
    caseRow: Record<string, unknown> | null,
    studentQuestion: string
  ) => {
    const diagnostics = getText(
      caseRow,
      "diagnostic_findings",
      "No diagnostic tests have been performed yet."
    );
    return `You are a laboratory technician. Share the exact test result that was requested. Do not speculate beyond the data.\n\nAvailable results:\n${diagnostics}\n\nStudent request: ${studentQuestion}`;
  },
  getOwnerFollowUpPrompt: (
    caseRow: Record<string, unknown> | null,
    studentQuestion: string
  ) => {
    const title = getCaseTitle(caseRow);
    const followUp = getText(
      caseRow,
      "owner_follow_up",
      defaultFollowUp(title)
    );
    return `You are the owner discussing next steps after the initial examination. Start slightly anxious, ask about logistics, cost, and comfort for your animal, and become more cooperative once the clinician explains their plan.\n\nGuidance:\n${followUp}\n\nStudent's explanation/question: ${studentQuestion}`;
  },
  getOwnerFollowUpFeedbackPrompt: (
    caseRow: Record<string, unknown> | null,
    context: string
  ) => {
    const followUpFeedback = getText(
      caseRow,
      "owner_follow_up_feedback",
      defaultFollowUpFeedback
    );
    return `Review the student's diagnostic planning and communication with the owner. Use the context below and provide structured feedback.\n\nConversation context:\n${context}\n\nFeedback guidance:\n${followUpFeedback}`;
  },
  getOwnerDiagnosisPrompt: (
    caseRow: Record<string, unknown> | null,
    studentQuestion: string
  ) => {
    const title = getCaseTitle(caseRow);
    const ownerDx = getText(
      caseRow,
      "owner_diagnosis",
      defaultDiagnosisPrompt(title)
    );
    return `You are receiving the diagnosis and treatment plan for ${title}. Ask about timelines, monitoring, costs, and long-term prognosis.\n\nOwner profile:\n${ownerDx}\n\nStudent explanation: ${studentQuestion}`;
  },
  getOverallFeedbackPrompt: (
    caseRow: Record<string, unknown> | null,
    context: string
  ) => {
    const overview = getText(
      caseRow,
      "get_overall_feedback_prompt",
      defaultOverallFeedback
    );
    return `Provide a concise, motivational summary of the student's performance using the context below.\n\nConversation context:\n${context}\n\nFeedback guidance:\n${overview}`;
  },
};
