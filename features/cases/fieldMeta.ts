import { OWNER_AVATARS, NURSE_AVATARS } from "@/features/personas/data/avatar-profiles";

export type CaseFieldKey =
	| "id"
	| "title"
	| "description"
	| "species"
	| "condition"
	| "category"
	| "owner_avatar_key"
	| "nurse_avatar_key"
	| "difficulty"
	| "estimated_time"
	| "image_url"
	| "timepoints"
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
	| "get_overall_feedback_prompt";

export type CaseFieldOption = {
	value: string;
	label: string;
};

export type CaseFieldMeta = {
	key: CaseFieldKey;
	label: string;
	placeholder?: string;
	help?: string;
	multiline?: boolean;
	rows?: number;
	options?: CaseFieldOption[];
};

const categoryOptions: CaseFieldOption[] = [
	{ value: "canine", label: "Canine" },
	{ value: "feline", label: "Feline" },
	{ value: "equine", label: "Equine" },
	{ value: "large animal", label: "Large Animal" },
	{ value: "exotics", label: "Exotics" },
];

const ownerAvatarOptions: CaseFieldOption[] = OWNER_AVATARS.map((avatar) => ({
	value: avatar.id,
	label: `${avatar.displayName} - ${avatar.personality} [${avatar.voiceId}]`,
}));

const nurseAvatarOptions: CaseFieldOption[] = NURSE_AVATARS.map((avatar) => ({
	value: avatar.id,
	label: `${avatar.displayName} - ${avatar.personality} [${avatar.voiceId}]`,
}));

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
		placeholder: "Equine",
		help: "Primary species or patient type for the scenario (e.g., Equine, Canine, Bovine).",
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
		placeholder: "Select a discipline",
		help: "Used to group cases for browsing and analytics.",
		options: categoryOptions,
	},
	{
		key: "owner_avatar_key",
		label: "Owner avatar",
		placeholder: "Select owner persona",
		help: "Choose the owner persona assigned to this case.",
		options: ownerAvatarOptions,
	},
	{
		key: "nurse_avatar_key",
		label: "Nurse avatar",
		placeholder: "Select nurse persona",
		help: "Choose the nurse persona who will report exam findings.",
		options: nurseAvatarOptions,
	},
	{
		key: "timepoints",
		label: "Time progression checkpoints",
		help:
			"Configure follow-up visits (e.g., Day 2, Recheck) that unlock after the main stages.",
	},
	{
		key: "difficulty",
		label: "Difficulty",
		placeholder: "Easy | Medium | Hard",
		help: "Learner-facing difficulty indicator. Also influences feedback tone.",
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
		key: "details",
		label: "Case details (JSON)",
		placeholder: '{"presenting_complaint": "Owner reports..."}',
		help: "Structured metadata (JSON) such as presenting complaint, duration, learning objectives, etc.",
		multiline: true,
		rows: 6,
	},
	{
		key: "physical_exam_findings",
		label: "Physical exam findings",
		placeholder: "Vitals, system-by-system findings, notable abnormalities...",
		help: "Reference script for the assistant when the learner asks for physical exam data.",
		multiline: true,
		rows: 5,
	},
	{
		key: "diagnostic_findings",
		label: "Diagnostic findings",
		placeholder: "Lab work, imaging, or point-of-care tests available on request...",
		help: "Results released by the lab persona. Use bullet points for clarity.",
		multiline: true,
		rows: 5,
	},
	{
		key: "owner_background",
		label: "Owner background",
		placeholder: "Role, personality cues, what information they will volunteer...",
		help: "Guides the owner persona's tone, concerns, and information boundaries.",
		multiline: true,
		rows: 6,
	},
	{
		key: "history_feedback",
		label: "History feedback prompt",
		placeholder: "Instructions for the professor persona when critiquing history-taking...",
		help: "Structured guidance for generating formative feedback after the history stage.",
		multiline: true,
		rows: 5,
	},
	{
		key: "owner_follow_up",
		label: "Owner follow-up script",
		placeholder: "Owner questions after physical exam and before diagnostics...",
		help: "Talking points for the owner persona once preliminary findings are shared.",
		multiline: true,
		rows: 5,
	},
	{
		key: "owner_follow_up_feedback",
		label: "Follow-up feedback prompt",
		placeholder: "Scoring criteria for diagnostic planning and communication...",
		help: "Feedback rubric for the instructor persona evaluating the follow-up conversation.",
		multiline: true,
		rows: 5,
	},
	{
		key: "owner_diagnosis",
		label: "Diagnosis conversation",
		placeholder: "Owner reactions, questions, and concerns after receiving the diagnosis...",
		help: "Reference dialogue for the owner persona during the diagnosis and plan stage.",
		multiline: true,
		rows: 5,
	},
	{
		key: "get_owner_prompt",
		label: "Owner chat prompt",
		placeholder: "Instruction template for the owner persona when chatting live...",
		help: "System prompt handed to the owner persona during live conversations.",
		multiline: true,
		rows: 5,
	},
	{
		key: "get_history_feedback_prompt",
		label: "History feedback instructions",
		placeholder: "LLM instructions for generating structured history feedback...",
		help: "Used to request formative feedback once the learner completes the history stage.",
		multiline: true,
		rows: 5,
	},
	{
		key: "get_physical_exam_prompt",
		label: "Physical exam prompt",
		placeholder: "Guidance for the assistant when providing physical exam data...",
		help: "System prompt for the virtual assistant responding with physical exam findings only when asked.",
		multiline: true,
		rows: 4,
	},
	{
		key: "get_diagnostic_prompt",
		label: "Diagnostics prompt",
		placeholder: "Instructions for the lab technician persona...",
		help: "Controls how the lab persona shares results and handles unavailable tests.",
		multiline: true,
		rows: 4,
	},
	{
		key: "get_owner_follow_up_prompt",
		label: "Owner follow-up prompt",
		placeholder: "Instructions for the owner persona during the follow-up discussion...",
		help: "Prompt for the owner persona after physical exam findings are shared.",
		multiline: true,
		rows: 4,
	},
	{
		key: "get_owner_follow_up_feedback_prompt",
		label: "Follow-up feedback instructions",
		placeholder: "Guidance for evaluating the learner's follow-up conversation...",
		help: "Used to generate structured feedback after the follow-up stage.",
		multiline: true,
		rows: 4,
	},
	{
		key: "get_owner_diagnosis_prompt",
		label: "Owner diagnosis prompt",
		placeholder: "Owner persona instructions when hearing the diagnosis...",
		help: "Script for the owner persona during the diagnosis/treatment explanation stage.",
		multiline: true,
		rows: 4,
	},
	{
		key: "get_overall_feedback_prompt",
		label: "Overall feedback prompt",
		placeholder: "Instructions for summarising the learner's performance...",
		help: "Final feedback rubric that produces an overall evaluation after the case.",
		multiline: true,
		rows: 4,
	},
];

export const caseFieldMeta: Record<CaseFieldKey, CaseFieldMeta> = metaList.reduce(
	(acc, item) => {
		acc[item.key] = item;
		return acc;
	},
	{} as Record<CaseFieldKey, CaseFieldMeta>
);

export const orderedCaseFieldKeys: CaseFieldKey[] = metaList.map(
	(item) => item.key
);

export const multilineFieldKeys = new Set(
	metaList.filter((item) => item.multiline).map((item) => item.key)
);

export function createEmptyCaseFormState(): Record<CaseFieldKey, string> {
	return orderedCaseFieldKeys.reduce((acc, key) => {
		acc[key] = "";
		return acc;
	}, {} as Record<CaseFieldKey, string>);
}

export function getFieldMeta(key: string): CaseFieldMeta | undefined {
	return caseFieldMeta[key as CaseFieldKey];
}
