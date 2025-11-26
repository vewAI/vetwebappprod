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

const getPresentingComplaint = (
  caseRow: Record<string, unknown> | null | undefined,
  title: string
) => {
  const direct =
    typeof caseRow?.presenting_complaint === "string"
      ? caseRow.presenting_complaint
      : null;

  if (direct && direct.trim().length > 0) {
    return direct.trim();
  }

  const details = caseRow?.details;
  if (details && typeof details === "object") {
    const candidate = (details as Record<string, unknown>)[
      "presenting_complaint"
    ];
    if (typeof candidate === "string" && candidate.trim().length > 0) {
      return candidate.trim();
    }
  }

  const condition =
    typeof caseRow?.condition === "string" && caseRow.condition.trim().length > 0
      ? caseRow.condition.trim()
      : null;

  if (condition) {
    return `Owner reports concerns consistent with ${condition}.`;
  }

  return `Owner reports initial concerns about ${title}.`;
};

const defaultOwnerBackground = (title: string) =>
  `Role: Animal Owner (concerned but cooperative)\nPatient: ${title}\n\nProvide clear, concise answers and volunteer information only when specifically asked.`;

const defaultHistoryFeedback = `You are an experienced veterinary educator providing feedback on the student's history-taking. Highlight what they did well, the gaps that remain, and offer 2-3 concrete follow-up questions they should still ask.`;

const defaultFollowUp = (title: string) =>
  `You are the owner of ${title}. You want to understand which diagnostic tests are necessary, why they matter, how much they cost, and what to expect for your animal.`;

const defaultFollowUpFeedback = `Provide structured feedback on how the student prioritised diagnostics, explained costs/benefits, and addressed biosecurity or home-care considerations.`;

const defaultDiagnosisPrompt = (title: string) =>
  `You are the owner receiving a diagnosis and discharge plan for ${title}. Ask practical questions about monitoring, medication, prognosis, and when to seek help.`;

const baseOverallFeedbackInstructions = `You are a senior veterinary OSCE examiner. Review the conversation transcript and deliver a candid, evidence-based performance evaluation.

Rules:
- Treat the transcript as the only evidence. If a question, explanation, or counselling point is absent, assume the student did not cover it.
- Describe strengths only when the transcript clearly demonstrates them. Avoid generic praise.
- Call out missing infectious-disease control measures, skipped diagnostics, or weak client explanations explicitly when they occur.
- Keep the tone professional but direct—do not say the performance was excellent if major steps were omitted.
- Structure the response exactly as:
  **Performance Snapshot:** One short paragraph tying observed behaviours to overall competence.
  **Strengths observed:** Bullet list of concrete positives; if none exist, write "- None observed in this transcript."
  **Critical gaps:** Bullet list (minimum two items) naming the highest-priority deficiencies and referencing the relevant stage (history, physical exam, diagnostics, client communication) or case objective.
  **Recommended next steps:** Bullet list of actionable items the student must do next time (e.g., specific history domains, diagnostics to order, isolation instructions).
- Close with a single sentence that is encouraging yet honest about the need for improvement.`;

const defaultOverallFeedbackCaseFocus = `Use the case''s learning objectives, stage descriptions, and transcript evidence to judge whether the student:
- Collected the history domains implied by the scenario (signalment, exposure risks, progression, owner constraints).
- Completed or clearly outlined an appropriate physical examination strategy.
- Recommended diagnostics aligned with the case goals and explained their rationale, cost, and logistics.
- Communicated management, isolation/biosecurity, or follow-up instructions suitable for the species and setting.
Whenever the transcript omits one of these pillars, flag it explicitly as a deficiency.`;

export const dbRoleInfo: RoleInfo = {
  getOwnerPrompt: (
    caseRow: Record<string, unknown> | null,
    studentQuestion: string
  ) => {
    const title = getCaseTitle(caseRow);
    const presentingComplaint = getPresentingComplaint(caseRow, title);
    const ownerBackground = getText(
      caseRow,
      "owner_background",
      defaultOwnerBackground(title)
    );
    return `You are roleplaying as the owner or caretaker in a veterinary consultation. Stay in character according to the background below and speak in natural, conversational language.

Presenting complaint (use these exact facts to open the discussion and to answer related questions):
${presentingComplaint}

Owner background:
${ownerBackground}

Guidelines:
- Begin by describing the presenting complaint in your own words using everyday phrasing from the owner's point of view, but stay consistent with the facts above.
- Feel free to add context (timeline, management details, behaviour changes) that aligns with the presenting complaint or with obvious manifestations of the condition referenced above, but do not invent new or contradictory symptoms. Avoid generic phrases like "I'm worried about her health and want to ensure we address it properly"—use specific owner observations instead.
- Answer the clinician's follow-up questions honestly, even if they did not explicitly ask yet, whenever the information above makes it relevant.
- Never attempt to diagnose or use technical jargon beyond what is provided. Remain a non-expert narrator of what you have observed.

Student's question: ${studentQuestion}

Stay true to the owner personality, collaborate willingly, and avoid offering diagnostic reasoning of your own.`;
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
    return `You are a veterinary nurse/technician and the physical examination has already been completed. Your only job is to report the recorded results that match what the student is asking about.\n\nCompleted examination record:\n${findings}\n\nRules:\n- Do not describe how to examine or suggest next steps.\n- Before you answer, scan the entire record above. When the student mentions a body system, structure, or symptom, quote every relevant recorded finding verbatim (include the exact measurements or descriptive qualifiers). Never summarise as "within normal limits" when any abnormal data are documented for that body system.\n- Always include the pertinent vital signs when the question relates to a system that relies on them (e.g., respiratory system questions should report respiratory rate and any fever).\n- If the request is broad ("full exam"), give a concise rundown of all vitals and abnormal findings that were documented.\n- If the chart lacks data for the requested item, say "No recorded findings for <item>." Never invent findings.\n- Present the answer as a short, scannable list so the measurements stand out.\n\nStudent request: ${studentQuestion}`;
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
      defaultOverallFeedbackCaseFocus
    );
    return `${baseOverallFeedbackInstructions}\n\nCase-specific priorities:\n${overview}\n\nConversation context:\n${context}`;
  },
};
