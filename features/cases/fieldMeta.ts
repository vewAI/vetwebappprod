export type CaseFieldKey =
  | "id"
  | "title"
  | "description"
  | "species"
  | "patient_name"
  | "patient_age"
  | "patient_sex"
  | "condition"
  | "category"
  | "difficulty"
  | "version"
  | "tags"
  | "is_published"
  | "estimated_time"
  | "image_url"
  | "details"
  | "physical_exam_findings"
  | "diagnostic_findings"
  | "owner_background"
  | "history_feedback"
  | "owner_follow_up"
  | "owner_follow_up_feedback"
  | "owner_diagnosis"
  | "get_owner_prompt"
  | "get_history_feedback_prompt"
  | "get_physical_exam_prompt"
  | "get_diagnostic_prompt"
  | "get_owner_follow_up_prompt"
  | "get_owner_follow_up_feedback_prompt"
  | "get_owner_diagnosis_prompt"
  | "get_overall_feedback_prompt"
  | "owner_avatar_url"
  | "nurse_avatar_url"
  | "owner_persona_id"
  | "nurse_persona_id"
  | "findings_release_strategy"
  | "owner_persona_config"
  | "nurse_persona_config";

export type CaseFieldMeta = {
  key: CaseFieldKey;
  label: string;
  placeholder?: string;
  help?: string;
  multiline?: boolean;
  rows?: number;
  options?: string[];
  isAvatarSelector?: boolean;
  avatarRole?: "owner" | "nurse";
  /** New persona editor field type */
  isPersonaEditor?: boolean;
  personaRole?: "owner" | "nurse";
};

const metaList: CaseFieldMeta[] = [
  {
    key: "id",
    label: "Case ID",
    placeholder: "Leave blank to auto-generate",
    help: "Optional identifier used internally. Use lowercase letters, numbers, or hyphens if you set one manually.",
  },
  {
    key: "title",
    label: "Case title",
    placeholder: "Catalina the Cob Mare: Fever and Nasal Discharge",
    help: "Displayed to learners on the case list and case header. Keep it descriptive and learner friendly.",
  },
  {
    key: "description",
    label: "Learner-facing summary",
    placeholder: "Brief paragraph that sets the scene for the learner...",
    help: "One-paragraph overview that appears on the landing page and case selection cards.",
    multiline: true,
    rows: 4,
  },
  {
    key: "species",
    label: "Species",
    placeholder: "Select species...",
    help: "Primary species or patient type for the scenario.",
    options: ["Equine", "Bovine", "Canine", "Feline", "Ovine", "Caprine", "Porcine", "Camelid", "Avian"],
  },
  {
    key: "patient_name",
    label: "Patient Name",
    placeholder: "e.g. Buster",
    help: "Name of the animal patient.",
  },
  {
    key: "patient_age",
    label: "Patient Age",
    placeholder: "e.g. 8 years",
    help: "Age of the patient.",
  },
  {
    key: "patient_sex",
    label: "Patient Sex",
    placeholder: "Select sex...",
    help: "Sex/Gender of the patient.",
    options: ["Male", "Female", "Gelding", "Mare", "Stallion", "Steer", "Heifer", "Bull", "Cow"],
  },
  {
    key: "condition",
    label: "Primary condition",
    placeholder: "Suspected Streptococcus equi infection",
    help: "Top-level medical focus shown in summaries and used to steer AI responses.",
  },
  {
    key: "category",
    label: "Discipline / category",
    placeholder: "Select category...",
    help: "Used to group cases for browsing and analytics.",
    options: [
      "Internal Medicine",
      "Surgery",
      "Infectious Disease",
      "Theriogenology",
      "Anesthesiology",
      "Dermatology",
      "Ophthalmology",
      "Neurology",
      "Cardiology",
      "Oncology",
      "Dentistry",
      "Sports Medicine",
      "Preventive Medicine",
    ],
  },
  {
    key: "difficulty",
    label: "Difficulty",
    placeholder: "Easy | Medium | Hard",
    help: "Learner-facing difficulty indicator. Also influences feedback tone.",
  },
  {
    key: "version",
    label: "Version",
    placeholder: "1",
    help: "Incremental version number for tracking case updates.",
  },
  {
    key: "tags",
    label: "Tags",
    placeholder: "colic, equine, emergency",
    help: "Comma-separated tags for search and filtering.",
  },
  {
    key: "is_published",
    label: "Published",
    placeholder: "true/false",
    help: "Whether the case is visible to students.",
    options: ["true", "false"],
  },
  {
    key: "estimated_time",
    label: "Estimated time (minutes)",
    placeholder: "25",
    help: "Approximate duration learners should expect to complete the case.",
  },
  {
    key: "image_url",
    label: "Hero image URL",
    placeholder: "https://...",
    help: "Optional image displayed on case cards. Upload or paste a direct image URL.",
  },
  {
    key: "findings_release_strategy",
    label: "Findings Release Strategy",
    placeholder: "Select strategy...",
    help: "Controls how the avatar reveals diagnostic findings.",
    options: ["immediate", "on_demand"],
  },
  {
    key: "owner_persona_config",
    label: "Owner Persona",
    help: "Configure the owner character's appearance, name, gender, and voice.",
    isPersonaEditor: true,
    personaRole: "owner",
  },
  {
    key: "nurse_persona_config",
    label: "Nurse Persona",
    help: "Configure the veterinary nurse character's appearance, name, gender, and voice.",
    isPersonaEditor: true,
    personaRole: "nurse",
  },
  {
    key: "owner_avatar_url",
    label: "Owner Avatar (Legacy)",
    placeholder: "Select an avatar...",
    help: "Legacy field - use Owner Persona instead.",
    isAvatarSelector: true,
    avatarRole: "owner",
  },
  {
    key: "nurse_avatar_url",
    label: "Nurse Avatar (Legacy)",
    placeholder: "Select an avatar...",
    help: "Legacy field - use Nurse Persona instead.",
    isAvatarSelector: true,
    avatarRole: "nurse",
  },
  {
    key: "details",
    label: "Full Clinical History",
    placeholder: "Presenting complaint, signalment, history, environment, management, vaccinations, timeline...",
    help: "Everything a student should discover through history-taking. Include all nuances — the AI will never remove details you provide.",
    multiline: true,
    rows: 10,
  },
  {
    key: "physical_exam_findings",
    label: "Physical Exam Findings (Reference Data)",
    placeholder: "Vitals (temp, HR, RR, CRT), body condition, system-by-system findings with values and units...",
    help: "The answer key for the exam — what the nurse persona reads back when a student examines the patient. Include every finding, even 'normal' baselines.",
    multiline: true,
    rows: 5,
  },
  {
    key: "diagnostic_findings",
    label: "Lab & Diagnostic Results (Answer Key)",
    placeholder: "Use a Markdown table for numeric results, e.g. | Test | Analyte | Value | Units | Reference Range | Note |",
    help: "Provide numeric results as a Markdown table with reference ranges and units for easy display. For imaging or narrative findings, add short bullet points below the table. Do NOT invent values — extract from the source or mark as pending.",
    multiline: true,
    rows: 6,
  },
  {
    key: "owner_background",
    label: "Owner Personality & Context",
    placeholder: "Who is the owner? How do they communicate? What are they worried about? What will they volunteer vs. withhold?",
    help: "Defines the owner character: personality, concerns, communication style, financial situation, and information boundaries for the AI to role-play.",
    multiline: true,
    rows: 6,
  },
  {
    key: "history_feedback",
    label: "History-Taking Rubric",
    placeholder: "What should a thorough history cover? List the key domains (onset, diet, vaccinations, exposure, etc.)...",
    help: "Defines what 'good history-taking' looks like for THIS case. The AI uses this to score and coach the student after the history stage.",
    multiline: true,
    rows: 5,
  },
  {
    key: "owner_follow_up",
    label: "Owner Post-Exam Questions",
    placeholder: "What does the owner ask after the exam? Cost concerns? Logistics? Comfort of the animal?",
    help: "Talking points the owner character raises once exam results are shared — tests, costs, timelines, and comfort.",
    multiline: true,
    rows: 5,
  },
  {
    key: "owner_follow_up_feedback",
    label: "Diagnostic Planning Rubric",
    placeholder: "How should a student explain and justify their diagnostic plan? What should they address?",
    help: "Rubric the AI uses to evaluate how well the student communicated their diagnostic plan, addressed costs, and handled owner concerns.",
    multiline: true,
    rows: 5,
  },
  {
    key: "owner_diagnosis",
    label: "Owner Diagnosis Reaction",
    placeholder: "How does the owner react to the diagnosis? Concerns about treatment, prognosis, other animals?",
    help: "Defines the owner's emotional reaction and follow-up questions when the student delivers the diagnosis and treatment plan.",
    multiline: true,
    rows: 5,
  },
  {
    key: "get_owner_prompt",
    label: "Owner AI Behaviour (auto-generated)",
    placeholder: "Instructions that tell the AI how to play the owner during live chat...",
    help: "Behind-the-scenes instructions for the owner AI during live history-taking. Auto-generated from Owner Personality & Context — only edit if you need specific tweaks.",
    multiline: true,
    rows: 5,
  },
  {
    key: "get_history_feedback_prompt",
    label: "History Feedback AI Rules (auto-generated)",
    placeholder: "How the AI should evaluate and coach the student's history-taking...",
    help: "Behind-the-scenes rules for the AI that scores history-taking. Auto-generated from the History-Taking Rubric — edit only for fine-tuning.",
    multiline: true,
    rows: 5,
  },
  {
    key: "get_physical_exam_prompt",
    label: "Nurse AI Behaviour (auto-generated)",
    placeholder: "How the nurse AI should reveal exam findings to the student...",
    help: "Behind-the-scenes instructions for the nurse AI that shares exam findings. Auto-generated — only edit for specific behaviour tweaks.",
    multiline: true,
    rows: 4,
  },
  {
    key: "get_diagnostic_prompt",
    label: "Lab Technician AI Behaviour (auto-generated)",
    placeholder: "How the lab AI should release test results to the student...",
    help: "Behind-the-scenes instructions for the lab technician AI. Auto-generated — only edit for specific result-release behaviour.",
    multiline: true,
    rows: 4,
  },
  {
    key: "get_owner_follow_up_prompt",
    label: "Owner Follow-Up AI Behaviour (auto-generated)",
    placeholder: "How the owner AI should behave during the diagnostic planning discussion...",
    help: "Behind-the-scenes instructions for the owner AI during the post-exam conversation. Auto-generated from Owner Post-Exam Questions.",
    multiline: true,
    rows: 4,
  },
  {
    key: "get_owner_follow_up_feedback_prompt",
    label: "Diagnostic Planning Feedback AI Rules (auto-generated)",
    placeholder: "How the AI should evaluate the student's diagnostic planning conversation...",
    help: "Behind-the-scenes rules for the AI that scores the diagnostic planning stage. Auto-generated from the Diagnostic Planning Rubric.",
    multiline: true,
    rows: 4,
  },
  {
    key: "get_owner_diagnosis_prompt",
    label: "Owner Diagnosis AI Behaviour (auto-generated)",
    placeholder: "How the owner AI should react during the diagnosis delivery...",
    help: "Behind-the-scenes instructions for the owner AI when receiving the diagnosis. Auto-generated from Owner Diagnosis Reaction.",
    multiline: true,
    rows: 4,
  },
  {
    key: "get_overall_feedback_prompt",
    label: "Final Case Summary AI Rules (auto-generated)",
    placeholder: "How the AI should summarise and score the student's overall case performance...",
    help: "Behind-the-scenes rules for the AI that produces the final performance summary. Auto-generated — edit only to adjust scoring criteria.",
    multiline: true,
    rows: 4,
  },
];

export const caseFieldMeta: Record<CaseFieldKey, CaseFieldMeta> = metaList.reduce(
  (acc, item) => {
    acc[item.key] = item;
    return acc;
  },
  {} as Record<CaseFieldKey, CaseFieldMeta>,
);

export const orderedCaseFieldKeys: CaseFieldKey[] = metaList.map((item) => item.key);

export const multilineFieldKeys = new Set(metaList.filter((item) => item.multiline).map((item) => item.key));

export function createEmptyCaseFormState(): Record<CaseFieldKey, string> {
  return orderedCaseFieldKeys.reduce(
    (acc, key) => {
      acc[key] = "";
      return acc;
    },
    {} as Record<CaseFieldKey, string>,
  );
}

export function getFieldMeta(key: string): CaseFieldMeta | undefined {
  return caseFieldMeta[key as CaseFieldKey];
}
