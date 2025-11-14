export const fieldMeta: Record<
  string,
  { label: string; placeholder?: string; help?: string }
> = {
  id: { label: "Case ID", placeholder: "Unique id (e.g. case-1)" },
  title: { label: "Title", placeholder: "Short case title (eg. Equine fever)" },
  description: {
    label: "Short description",
    placeholder: "One-sentence summary of the case for instructors",
    help: "Displayed in lists; keep concise (1–2 lines).",
  },
  details: {
    label: "Full case details",
    placeholder: "Clinical vignette and scenario details (long text)",
    help: "Include the full scenario and background used by the student.",
  },
  physical_exam_findings: {
    label: "Physical exam findings (role data)",
    placeholder: "Findings the assistant/actor should reveal when asked",
    help: "These are objective exam findings that the assistant will provide when the student requests them.",
  },
  diagnostic_findings: {
    label: "Diagnostic findings (lab results)",
    placeholder: "Structured test results to return when requested",
    help: "Only provide results for tests the student requests. Avoid unsolicited results.",
  },
  owner_background: {
    label: "Owner background (role script)",
    placeholder: "Owner persona and key points to roleplay",
    help: "Character notes, emotional tone, and what the owner should/shouldn't disclose.",
  },
  history_feedback: {
    label: "History feedback (educator)",
    placeholder: "Evaluation guidance for history-taking",
    help: "Structured feedback prompts used by the feedback generator.",
  },
  owner_follow_up: {
    label: "Owner follow-up prompts",
    placeholder: "What the owner asks/needs after initial workup",
    help: "Used during follow-up stage to roleplay owner questions.",
  },
  owner_follow_up_feedback: {
    label: "Follow-up feedback",
    placeholder: "Feedback guidance for follow-up planning",
    help: "Used to generate educator feedback for the follow-up stage.",
  },
  owner_diagnosis: {
    label: "Owner-facing diagnosis text",
    placeholder: "How to explain the diagnosis to the owner",
    help: "Plain-language explanation to be used in the final communication stage.",
  },
  // Prompt templates used by LLMs
  get_owner_prompt: {
    label: "Owner prompt template",
    placeholder: "Template to build the owner role LLM prompt",
    help: "Template values like {ownerBackground} are merged at runtime.",
  },
  get_history_feedback_prompt: {
    label: "History feedback prompt",
    placeholder: "Prompt template for history feedback generation",
    help: "LLM prompt used to generate structured history feedback.",
  },
  get_physical_exam_prompt: {
    label: "Physical exam prompt",
    placeholder: "Prompt template for physical exam role",
    help: "Used to instruct the assistant/actor what to reveal during the exam.",
  },
  get_diagnostic_prompt: {
    label: "Diagnostic prompt",
    placeholder: "Prompt template for diagnostic/lab role",
    help: "Used to instruct the lab technician role when providing results.",
  },
  get_owner_follow_up_prompt: {
    label: "Owner follow-up prompt",
    placeholder: "Prompt template for follow-up roleplay",
    help: "Used to build owner follow-up messages.",
  },
  get_owner_follow_up_feedback_prompt: {
    label: "Owner follow-up feedback prompt",
    placeholder: "Prompt template for follow-up feedback",
    help: "Used by the feedback generator for the follow-up stage.",
  },
  get_owner_diagnosis_prompt: {
    label: "Owner diagnosis prompt",
    placeholder: "Prompt template for owner diagnosis communication",
    help: "Template that formats how the diagnosis should be explained.",
  },
  get_overall_feedback_prompt: {
    label: "Overall feedback prompt",
    placeholder: "Prompt template for end-to-end performance feedback",
    help: "Used to generate the final overall feedback for the attempt.",
  },
};

export default fieldMeta;
