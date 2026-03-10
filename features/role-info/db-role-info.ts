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

const extractCaseField = (
  caseRow: Record<string, unknown> | null | undefined,
  key: string
): string => {
  if (!caseRow || typeof caseRow !== "object") {
    return "";
  }
  const value = (caseRow as Record<string, unknown>)[key];
  return typeof value === "string" ? value.trim() : "";
};

const buildPhysicalExamFallback = (
  caseRow: Record<string, unknown> | null | undefined
): string => {
  const title = getCaseTitle(caseRow);
  const presentingComplaint = getPresentingComplaint(caseRow, title);
  const condition = extractCaseField(caseRow, "condition");
  const species = extractCaseField(caseRow, "species");
  const description = extractCaseField(caseRow, "description");

  const contextLines: string[] = [];
  if (presentingComplaint) {
    contextLines.push(`Presenting complaint: ${presentingComplaint}`);
  }
  if (condition) {
    contextLines.push(`Working impression: ${condition}`);
  }
  if (species) {
    contextLines.push(`Species: ${species}`);
  }
  if (description && description !== presentingComplaint) {
    contextLines.push(`Case summary: ${description}`);
  }
  if (contextLines.length === 0) {
    contextLines.push(`Case context: ${title}`);
  }
  contextLines.push(
    [
      "Use these instructions to report the completed exam:",
      "- Provide exact vital signs (temperature, heart rate, respiratory rate, perfusion measures) as recorded.",
      "- List every abnormal finding that aligns with this scenario—lymph node enlargement, discharges, pain responses, hydration, gastrointestinal changes, or other pertinent systems.",
      "- Mark a system as normal only when the case details support it; otherwise supply physiologically plausible abnormal measurements consistent with this context."
    ].join("\n")
  );

  return contextLines.join("\n");
};

const baseOverallFeedbackInstructions = `You are a senior veterinary OSCE examiner using the Calgary-Cambridge consultation framework to evaluate clinical communication competence.

CORE PRINCIPLE: Assess COMMUNICATION PROCESS (how the student interacted) independently from CLINICAL CONTENT (what they knew). A student may have weak diagnostic reasoning but excellent communication, or vice versa.

PERFORMANCE vs COMPETENCE: Rate what the student ACTUALLY DID in the transcript (performance), not what they could potentially do (competence). Only credit demonstrated actions.

---

CONSULTATION ARC EVALUATION
Assess the student's performance across the full consultation journey:

1. INITIATING THE SESSION
   - Did they establish rapport with the owner/client upfront?
   - Did they identify the presenting complaint clearly?
   - Did they signal the agenda for the consultation?

2. GATHERING INFORMATION
   - Did they ask open questions initially, then focus with closed questions?
   - Was their questioning logical and systematic?
   - Did they explore the owner's perspective, concerns, and expectations?
   - Did they demonstrate active listening (reflective, summarizing)?

3. BUILDING RELATIONSHIP & NON-VERBAL TONE
   - Was the student attentive and respectful?
   - Did they adapt their language to the owner's level?
   - Did they acknowledge emotions or concerns the owner expressed?

4. EXPLANATION & PLANNING (Diagnostic Reasoning Communication)
   - When presenting findings or diagnostics, did they explain the REASONING?
   - Did they prioritize tests by logic, not just list them?
   - Did they discuss cost, logistics, and timeline with the owner?
   - Did they check the owner's understanding?
   - Did they explore the owner's preferences or constraints?

5. CLOSURE
   - Did they confirm the plan with the owner?
   - Did they provide clear follow-up instructions?
   - Did they invite final questions?
   - Did they signal when/how to contact the clinic?

---

LIVESTOCK/HERD HEALTH CONSIDERATIONS (if applicable)
- Did the student address biosecurity or isolation?
- Did they discuss cost-effectiveness for herd management contexts?
- If a farm case: Did they consider practical constraints (labor, facilities)?

---

FEEDBACK SECTIONS (Mandatory Structure)

**PERFORMANCE SNAPSHOT:** One short paragraph connecting observed communication behaviors to overall clinical competence.

**COMMUNICATION STRENGTHS OBSERVED:** Bullet list of specific communication processes done well with transcript evidence. If none: "- None observed in this transcript."

**CRITICAL GAPS IN COMMUNICATION:** Minimum 2-3 items. Name the Calgary-Cambridge domain (gathering, explaining, closure, etc.) and cite evidence.

**RECOMMENDED NEXT STEPS:** Actionable items for targeted practice (e.g., "Use open questions first", "Always explain diagnostic reasoning", "Check for understanding before closing").

**CLOSING SENTENCE:** Honest yet encouraging, balanced statement about communication competence and growth trajectory.

---

CRITICAL ASSESSMENT RULES
1. Treat transcript as ONLY evidence. If a communication move is absent, assume the student did not do it.
2. Do NOT give generic praise without evidence. Always cite specific interactions.
3. Do NOT confuse clinical knowledge with communication. A student might explain a diagnosis poorly due to communication gaps, not knowledge gaps.
4. Do NOT compare to peers. Use criterion-referenced standards from Calgary-Cambridge.
5. Rate COMMUNICATION PROCESS independently from clinical content. Both matter, but evaluate separately.
6. This is PERFORMANCE-BASED assessment: what they actually did, not what they could do.

---

RATER BIAS AWARENESS
This feedback is written fresh from this transcript using criterion-referenced Calgary-Cambridge standards. Each consultation is judged against the gold standard, not against other students' interactions.`;

const defaultOverallFeedbackCaseFocus = `CASE-SPECIFIC EVALUATION FOCUS

Judge the student on:
- HISTORY GATHERING: Did they collect the history domains implied by the scenario (signalment, exposure risks, progression, owner constraints)? Was questioning systematic and exploratory?
- PHYSICAL EXAMINATION: Did they complete or clearly outline an appropriate exam strategy? Did they communicate findings accessibly to the owner?
- DIAGNOSTIC REASONING & COMMUNICATION: Did they recommend diagnostics aligned with case goals AND explain the rationale, cost, and logistics in plain language the owner understood?
- CLIENT COMMUNICATION: Did they communicate management, isolation/biosecurity, or follow-up instructions suitable for the species and setting? Did they check for understanding?
- LIVESTOCK/HERD-SPECIFIC (if applicable): Did they address cost-effectiveness, practical farm constraints, and biosecurity in context? Did they prioritize by urgency and feasibility?

FLAG EXPLICITLY: When the transcript omits one of these pillars or shows weak communication on it—this is evidence of a communication gap, not just clinical knowledge gap.

REMEMBER: A student may know the right diagnostic test but fail to communicate its purpose clearly. That is a communication failure, not a knowledge failure, and feedback should target the communication skill.`;

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
      buildPhysicalExamFallback(caseRow)
    );
    return `You are a veterinary nurse/technician and the physical examination has already been completed. Your only job is to report the recorded results that match what the student is asking about.\n\nCompleted examination record:\n${findings}\n\nRules:\n- Do not describe how to examine or suggest next steps.\n- Before you answer, scan the entire record above. When the student mentions a body system, structure, or symptom, quote every relevant recorded finding verbatim (include the exact measurements or descriptive qualifiers). Never summarise as "within normal limits" when any abnormal data are documented for that body system.\n- Always include the pertinent vital signs when the question relates to a system that relies on them (e.g., respiratory system questions should report respiratory rate and any fever).\n- If the chart lacks data for the requested item, do NOT invent or guess values. Reply clearly: "That finding was not recorded during the exam." If a parameter is not recorded, do not fabricate a plausible value.\n- Present the answer as a short, scannable list so the measurements stand out.\n\nStudent request: ${studentQuestion}`;
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
