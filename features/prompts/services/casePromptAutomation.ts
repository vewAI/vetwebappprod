import type { PromptDefinition } from "../types";
import {
  DEFAULT_DIAGNOSTIC_PROMPT_COPY,
  type DiagnosticPromptCopy,
} from "../config/diagnosticPrompts";

export type CaseRow = Record<string, unknown>;

export const CASE_AUTOMATION_FIELDS = [
  "details",
  "physical_exam_findings",
  "diagnostic_findings",
  "owner_background",
  "history_feedback",
  "owner_follow_up",
  "owner_follow_up_feedback",
  "owner_diagnosis",
  "get_owner_prompt",
  "get_history_feedback_prompt",
  "get_physical_exam_prompt",
  "get_diagnostic_prompt",
  "get_owner_follow_up_prompt",
  "get_owner_follow_up_feedback_prompt",
  "get_owner_diagnosis_prompt",
  "get_overall_feedback_prompt",
] as const;

export type CaseAutomationField = (typeof CASE_AUTOMATION_FIELDS)[number];

const CASE_AUTOMATION_FIELD_SET = new Set<CaseAutomationField>(
  CASE_AUTOMATION_FIELDS
);

interface PersonaConfig {
  ownerName?: string;
  animalName?: string;
  patientDescriptor?: string;
  setting?: string;
  presentingComplaint?: string;
  duration?: string;
  environmentSummary?: string;
  learningObjectives?: string[];
  physicalExam?: {
    vitals?: string[];
    findings?: string[];
  };
  diagnosticHighlights?: string[];
}

interface PersonaData {
  ownerName: string;
  animalName: string;
  patientDescriptor: string;
  setting: string;
  presentingComplaint: string;
  duration: string;
  environmentSummary: string;
  learningObjectives: string[];
  physicalExamVitals: string[];
  physicalExamFindings: string[];
  diagnosticHighlights: string[];
  diagnosticLabValues: string[];
}

interface CaseDetails {
  presentingComplaint?: string;
  duration?: string;
  environment?: string;
  setting?: string;
  ownerName?: string;
  patientName?: string;
  learningObjectives?: string[];
  physicalExamFindings?: string[];
  labValues?: string[];
  diagnosticHighlights?: string[];
}

const CASE_PERSONA_CONFIG: Record<string, PersonaConfig> = {
  "case-1": {
    ownerName: "Elena Martinez",
    animalName: "Catalina",
    patientDescriptor: "3-year-old Cob mare",
    setting: "busy multi-owner equine boarding yard",
    presentingComplaint:
      "36 hours of reduced appetite, fever, and new mandibular swelling after new horses joined the boarding yard.",
    duration: "36 hours",
    environmentSummary:
      "45-horse boarding facility with frequent turnover and shared tack between owners.",
    learningObjectives: [
      "Practice open-ended infectious-disease history taking in equine outbreaks.",
      "Prioritise physical exam data before proposing diagnostics.",
      "Communicate isolation and biosecurity steps clearly to barn stakeholders.",
    ],
    physicalExam: {
      vitals: [
        "Temp: 39.7°C",
        "Heart rate: 48 bpm",
        "Respiratory rate: 16 breaths/min",
      ],
      findings: [
        "Enlarged (2 cm) warm submandibular lymph node",
        "Mild serous nasal discharge",
        "Mildly reduced gut sounds; otherwise within normal limits",
      ],
    },
    diagnosticHighlights: [
      "CBC: Mild neutrophilia (14.8 x10^9/L)",
      "Fibrinogen: 5.5 g/L",
      "Serum biochemistry: Within normal limits",
      "Nasopharyngeal swab PCR: Pending",
      "Lymph node ultrasound: Hypoechoic core with surrounding edema",
    ],
  },
  "case-2": {
    ownerName: "Laura Chen",
    animalName: "Milo",
    patientDescriptor: "5-month-old Labrador retriever",
    setting: "downtown apartment after frequent dog-park visits",
    presentingComplaint:
      "48 hours of profuse vomiting progressing to bloody diarrhea following a crowded dog-park visit.",
    duration: "48 hours",
    environmentSummary:
      "High-density apartment building with shared outdoor spaces and multiple canine contacts.",
    learningObjectives: [
      "Elicit exposure and vaccination history in high-risk puppies.",
      "Prioritise triage, isolation, and intensive care planning for parvoviral enteritis.",
      "Communicate prognosis and hospital logistics empathetically while addressing finances.",
    ],
    physicalExam: {
      vitals: [
        "Temp: 39.6°C",
        "Heart rate: 180 bpm (weak pulses)",
        "Respiratory rate: 40 breaths/min",
      ],
      findings: [
        "Approximately 10% dehydrated with tacky mucous membranes and CRT 3 sec",
        "Abdominal pain on palpation; splenomegaly not appreciated",
        "Melena present on rectal exam; profound lethargy",
      ],
    },
    diagnosticHighlights: [
      "SNAP Parvo antigen: Strong positive",
      "CBC: WBC 1.2 x10^9/L (marked leukopenia), HCT 58%, platelets 110 x10^9/L",
      "Electrolytes: Na 132 mmol/L, K 3.0 mmol/L, Cl 91 mmol/L",
      "Blood glucose: 62 mg/dL",
      "Abdominal ultrasound: Diffuse fluid-filled intestinal loops, no intussusception",
    ],
  },
  "case-3": {
    ownerName: "Daniel Reyes",
    animalName: "Rosie",
    patientDescriptor: "high-output Holstein dairy cow",
    setting: "600-cow family-operated dairy parlour",
    presentingComplaint:
      "Recurrent mastitis in the right rear quarter with clots and watery milk over the past six weeks.",
    duration: "Six-week recurrence pattern",
    environmentSummary:
      "High-throughput parlour with rotating staff and pressure to maintain premium bulk-tank quality.",
    learningObjectives: [
      "Link individual-cow findings to herd-level contagious mastitis risks.",
      "Interpret culture, PCR, and SCC data to guide management changes.",
      "Coach producers through hygiene improvements with economic framing.",
    ],
    physicalExam: {
      vitals: [
        "Temp: 39.1°C",
        "Heart rate: 88 bpm",
        "Rumen motility: 2 contractions/2 minutes (within normal limits)",
      ],
      findings: [
        "Right rear quarter swollen, warm, mildly painful",
        "Stripped milk watery with flakes and streaks of blood",
        "Supramammary lymph node enlarged",
      ],
    },
    diagnosticHighlights: [
      "Cow-side CMT: +++ in right rear quarter",
      "Bulk-tank SCC trend: 180k → 420k cells/mL over four weeks",
      "Milk culture: Staphylococcus aureus (beta-lactamase positive)",
      "PCR mastitis panel: Confirms Staph aureus, negative for Mycoplasma",
      "Antimicrobial sensitivity: Susceptible to ceftiofur and pirlimycin, resistant to penicillin",
    ],
  },
};

const VETERINARY_ASSISTANT_NAME = "Avery";
const LAB_TECHNICIAN_NAME = "Jordan";

const stringField = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

const parseLinesFromText = (text: string): string[] => {
  return text
    .replace(/\r/g, "\n")
    .split(/\n+/)
    .flatMap((line) => line.split(/\s*;\s*/))
    .map((segment) => segment.replace(/^[\s•*\-\d\.]+/, "").trim())
    .filter((segment) => segment.length > 0);
};

const toStringArray = (value: unknown): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .flatMap((item) => (typeof item === "string" ? parseLinesFromText(item) : []))
      .filter((item): item is string => item.length > 0);
  }
  if (typeof value === "string") {
    return parseLinesFromText(value);
  }
  return [];
};

const dedupeLines = (lines: string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const line of lines) {
    const normalised = line.toLowerCase();
    if (!seen.has(normalised)) {
      seen.add(normalised);
      result.push(line.trim());
    }
  }
  return result;
};

const hasNumeric = (line: string): boolean => /\d/.test(line);

const pickFirstNonEmpty = (
  ...candidates: Array<string[] | undefined | null>
): string[] => {
  for (const candidate of candidates) {
    if (!candidate) continue;
    const cleaned = dedupeLines(candidate.filter((line) => line.trim().length > 0));
    if (cleaned.length > 0) {
      return cleaned;
    }
  }
  return [];
};

const isVitalLine = (line: string): boolean =>
  /\b(temp(erature)?|heart|pulse|hr\b|resp(iratory)?|rr\b|capillary|crt\b|mucous|mm\b|blood pressure|bp\b|weight|body condition)\b/i.test(
    line
  );

const partitionVitals = (lines: string[]): { vitals: string[]; findings: string[] } => {
  const vitals: string[] = [];
  const findings: string[] = [];
  for (const line of lines) {
    if (isVitalLine(line)) {
      vitals.push(line);
    } else {
      findings.push(line);
    }
  }
  return {
    vitals: dedupeLines(vitals),
    findings: dedupeLines(findings),
  };
};

const DEFAULT_PHYSICAL_VITALS = [
  "Temperature: Document the exact reading and note whether it is pyrexic or hypothermic.",
  "Heart rate: Include rhythm or auscultation abnormalities versus normal ranges.",
  "Respiratory rate and effort: Comment on pattern, sounds, or effort compared with baseline.",
  "Perfusion metrics: Capillary refill time, mucous membrane colour, and pulse quality.",
];

const DEFAULT_PHYSICAL_FINDINGS = [
  "Highlight positive abnormalities relevant to the chief complaint.",
  "List key systems that are within normal limits to frame differential prioritisation.",
  "Mention demeanour, pain score, hydration status, and body condition if pertinent.",
];

const DEFAULT_DIAGNOSTIC_HIGHLIGHTS = [
  "Point-of-care tests that confirm or refute the working diagnosis.",
  "Advanced diagnostics that characterise complications or disease stage.",
  "Explain expected turnaround times and how pending results influence decision-making.",
];

const DEFAULT_DIAGNOSTIC_LAB_VALUES = [
  "CBC: Provide actual WBC, RBC, and platelet counts (e.g., WBC 12.5 x10^9/L) with interpretation.",
  "Serum chemistry: Highlight electrolyte or metabolic disturbances with numeric values (e.g., Na 132 mmol/L, K 3.0 mmol/L).",
  "Additional panels: Include disease-specific markers or imaging measurements with figures (e.g., fibrinogen 5.5 g/L, BHBA 1.8 mmol/L).",
];

const normaliseKey = (value: string): string => value.trim().toLowerCase();

function createDefaultLearningObjectives(condition: string): string[] {
  const key = normaliseKey(condition);
  if (!key) {
    return [
      "Gather a complete, chronological history tied to the presenting complaint.",
      "Prioritise physical exam findings before committing to diagnostics.",
      "Explain the initial diagnostic and management plan clearly to the client or care team.",
    ];
  }

  return [
    `Clarify exposure risks and predisposing factors relevant to ${condition.toLowerCase()}.`,
    `Use the physical exam to triage severity and guide diagnostics for ${condition.toLowerCase()}.`,
    `Coach the client on biosecurity, monitoring, and follow-up specific to ${condition.toLowerCase()}.`,
  ];
}

function createDefaultDiagnosticHighlights(condition: string): string[] {
  const key = normaliseKey(condition);
  if (!key) {
    return [...DEFAULT_DIAGNOSTIC_HIGHLIGHTS];
  }

  return [
    `Point-of-care diagnostics that support or refute ${condition.toLowerCase()}—include numeric data (e.g., WBC 12.5 x10^9/L).`,
    `Definitive tests for ${condition.toLowerCase()} with quantitative results or titers.`,
    `Additional imaging or monitoring that stages ${condition.toLowerCase()} and informs the care plan.`,
  ];
}

const CONDITION_PHYSICAL_EXAM_DEFAULTS: Record<
  string,
  { vitals: string[]; findings: string[] }
> = {
  [normaliseKey("Suspected Streptococcus equi infection")]: {
    vitals: [
      "Temp: 39.7°C",
      "Heart rate: 48 bpm",
      "Respiratory rate: 16 breaths/min",
    ],
    findings: [
      "Enlarged (2 cm) warm submandibular lymph node",
      "Mild serous nasal discharge",
      "Mildly reduced gut sounds; otherwise within normal limits",
    ],
  },
  [normaliseKey("Parvoviral enteritis")]: {
    vitals: [
      "Temp: 39.6°C",
      "Heart rate: 180 bpm (weak pulses)",
      "Respiratory rate: 40 breaths/min",
    ],
    findings: [
      "Approximately 10% dehydrated with tacky mucous membranes and CRT 3 sec",
      "Abdominal palpation reveals diffuse pain without palpable intussusception",
      "Melena present on rectal exam with marked lethargy",
    ],
  },
  [normaliseKey("Contagious mastitis outbreak")]: {
    vitals: [
      "Temp: 39.1°C",
      "Heart rate: 88 bpm",
      "Rumen motility: 2 contractions/2 minutes (within normal limits)",
    ],
    findings: [
      "Right rear quarter swollen, warm, mildly painful",
      "Stripped milk watery with flakes and streaks of blood",
      "Supramammary lymph node enlarged",
    ],
  },
};

const SPECIES_PHYSICAL_EXAM_DEFAULTS: Record<string, { vitals: string[]; findings: string[] }> = {
  [normaliseKey("equine")]: {
    vitals: ["Temp: 37.5-38.5°C", "Heart rate: 28-44 bpm", "Respiratory rate: 8-16 breaths/min"],
    findings: ["Assess lymph nodes, nasal discharge, and gut sounds for early infectious disease clues."],
  },
  [normaliseKey("canine")]: {
    vitals: ["Temp: 38.0-39.2°C", "Heart rate: 80-140 bpm", "Respiratory rate: 18-34 breaths/min"],
    findings: ["Document hydration, abdominal palpation changes, and stool character for gastroenteritis cases."],
  },
  [normaliseKey("bovine")]: {
    vitals: ["Temp: 38.0-39.3°C", "Heart rate: 60-80 bpm", "Respiratory rate: 24-36 breaths/min"],
    findings: ["Describe quarter-specific udder changes, milk appearance, and lymph node size."],
  },
};

export function getConditionPhysicalExamDefaults(
  condition: string,
  species: string
): { vitals: string[]; findings: string[] } {
  const byCondition = CONDITION_PHYSICAL_EXAM_DEFAULTS[normaliseKey(condition)];
  if (byCondition) {
    return byCondition;
  }

  const bySpecies = SPECIES_PHYSICAL_EXAM_DEFAULTS[normaliseKey(species)];
  if (bySpecies) {
    return bySpecies;
  }

  return { vitals: [], findings: [] };
}

const CONDITION_LAB_DEFAULTS: Record<string, string[]> = {
  [normaliseKey("Suspected Streptococcus equi infection")]: [
    "CBC: Mild neutrophilia (14.8 x10^9/L)",
    "Fibrinogen: 5.5 g/L",
    "Nasopharyngeal PCR: Pending; plan to confirm Strep equi equi",
    "Serum biochemistry: Within normal limits",
    "Lymph node ultrasound: Hypoechoic core with surrounding edema",
  ],
  [normaliseKey("Parvoviral enteritis")]: [
    "SNAP Parvo antigen: Strong positive",
    "CBC: WBC 1.2 x10^9/L, HCT 58%, platelets 110 x10^9/L",
    "Electrolytes: Na 132 mmol/L, K 3.0 mmol/L, Cl 91 mmol/L",
    "Blood glucose: 62 mg/dL",
    "Abdominal ultrasound: Fluid-filled intestinal loops without intussusception",
  ],
  [normaliseKey("Contagious mastitis outbreak")]: [
    "Cow-side CMT: +++ in right rear quarter",
    "Bulk-tank SCC trend: 180k → 420k cells/mL over four weeks",
    "Milk culture: Staphylococcus aureus (beta-lactamase positive)",
    "PCR mastitis panel: Confirms Staph aureus, negative for Mycoplasma",
    "Sensitivity: Susceptible to ceftiofur/pirlimycin, resistant to penicillin",
  ],
};

const SPECIES_LAB_DEFAULTS: Record<string, string[]> = {
  [normaliseKey("equine")]: [
    "CBC: Provide WBC/platelet counts with interpretation (e.g., WBC 12.0 x10^9/L, fibrinogen 4.8 g/L)",
    "Nasopharyngeal PCR or culture: Note turnaround and isolation recommendations",
  ],
  [normaliseKey("canine")]: [
    "CBC: Include neutrophil and lymphocyte counts (e.g., WBC 1.5 x10^9/L)",
    "Electrolytes: Report sodium, potassium, chloride with numbers",
    "Glucose: Document hypoglycemia or normoglycemia with mg/dL",
  ],
  [normaliseKey("bovine")]: [
    "Somatic cell count trends with numeric values",
    "Milk culture/PCR specifying organisms and resistance patterns",
  ],
};

function getConditionLabDefaults(condition: string, species: string): string[] {
  const byCondition = CONDITION_LAB_DEFAULTS[normaliseKey(condition)];
  if (byCondition) {
    return byCondition;
  }

  const bySpecies = SPECIES_LAB_DEFAULTS[normaliseKey(species)];
  if (bySpecies) {
    return bySpecies;
  }

  return [];
}

const parseCaseDetails = (value: unknown): CaseDetails => {
  if (!value) {
    return {};
  }

  let source: unknown = value;
  if (typeof value === "string") {
    try {
      source = JSON.parse(value);
    } catch {
      return {};
    }
  }

  if (typeof source !== "object" || source === null) {
    return {};
  }

  const record = source as Record<string, unknown>;
  return {
    presentingComplaint: stringField(
      record.presenting_complaint ?? record.presentingComplaint
    ),
    duration: stringField(record.duration ?? record.course_length),
    environment: stringField(
      record.environment ?? record.setting ?? record.location
    ),
    setting: stringField(record.setting ?? record.environment),
    ownerName: stringField(
      record.owner_name ?? record.ownerName ?? record.caretakerName
    ),
    patientName: stringField(
      record.patient_name ?? record.patientName ?? record.animalName
    ),
    learningObjectives: toStringArray(
      record.learning_objectives ?? record.learningObjectives
    ),
    physicalExamFindings: toStringArray(
      record.physical_exam_findings ??
        record.physicalExamFindings ??
        record.physical_exam
    ),
    labValues: toStringArray(
      record.lab_values ??
        record.labValues ??
        record.diagnostic_lab_values ??
        record.diagnosticLabValues
    ).filter(hasNumeric),
    diagnosticHighlights: toStringArray(
      record.diagnostic_highlights ?? record.diagnosticHighlights
    ),
  };
};

const deriveAnimalName = (
  title: string,
  species: string,
  details: CaseDetails
): string => {
  if (details.patientName) {
    return details.patientName;
  }

  const titleMatch = title.match(/^([A-Z][a-zA-Z'-]{2,})\b/);
  if (titleMatch) {
    return titleMatch[1];
  }

  if (species) {
    return species.toLowerCase() === "human"
      ? "the patient"
      : `the ${species.toLowerCase()} patient`;
  }

  return "the patient";
};

const resolvePersonaData = (
  caseId: string,
  caseRow: CaseRow,
  summary: string,
  species: string,
  condition: string
): PersonaData => {
  const overrides = CASE_PERSONA_CONFIG[caseId] ?? {};
  const details = parseCaseDetails(caseRow.details);
  const title = stringField(caseRow.title);

  const ownerFromRow = stringField(
    (caseRow as Record<string, unknown>).owner_name ??
      (caseRow as Record<string, unknown>).ownerName
  );

  const ownerName =
    overrides.ownerName ||
    details.ownerName ||
    ownerFromRow ||
    "Case owner";

  const animalName =
    overrides.animalName ||
    details.patientName ||
    deriveAnimalName(title, species, details);

  const patientDescriptor =
    overrides.patientDescriptor ||
    (species && condition
      ? `${species.toLowerCase()} patient facing ${condition.toLowerCase()}`
      : species
      ? `${species.toLowerCase()} patient`
      : "patient");

  const setting =
    overrides.setting ||
    details.setting ||
    details.environment ||
    stringField((caseRow as Record<string, unknown>).setting) ||
    "their current environment";

  const presentingComplaint =
    overrides.presentingComplaint ||
    details.presentingComplaint ||
    summary ||
    (condition
      ? `Clinical signs associated with ${condition.toLowerCase()}`
      : "The presenting complaint described in the summary");

  const duration =
    overrides.duration ||
    details.duration ||
    stringField((caseRow as Record<string, unknown>).duration) ||
    "recent onset";

  const environmentSummary =
    overrides.environmentSummary ||
    details.environment ||
    setting ||
    "the environment described in the case";

  const learningObjectives = pickFirstNonEmpty(
    overrides.learningObjectives,
    details.learningObjectives,
    createDefaultLearningObjectives(condition)
  );

  const physicalExamFromRow = toStringArray(
    (caseRow as Record<string, unknown>).physical_exam_findings ??
      (caseRow as Record<string, unknown>).physicalExamFindings
  );
  const combinedPhysicalExam = dedupeLines([
    ...physicalExamFromRow,
    ...(details.physicalExamFindings ?? []),
  ]);
  const { vitals: physicalVitalsData, findings: physicalFindingsData } =
    partitionVitals(combinedPhysicalExam);

  const conditionExamDefaults = getConditionPhysicalExamDefaults(
    condition,
    species
  );

  const physicalExamVitals = pickFirstNonEmpty(
    physicalVitalsData,
    overrides.physicalExam?.vitals,
    conditionExamDefaults.vitals,
    DEFAULT_PHYSICAL_VITALS
  );

  const physicalExamFindings = pickFirstNonEmpty(
    physicalFindingsData,
    overrides.physicalExam?.findings,
    conditionExamDefaults.findings,
    DEFAULT_PHYSICAL_FINDINGS
  );

  const diagnosticInstructions = pickFirstNonEmpty(
    toStringArray(
      (caseRow as Record<string, unknown>).diagnostic_instructions ??
        (caseRow as Record<string, unknown>).diagnosticInstructions
    ),
    details.diagnosticHighlights,
  overrides.diagnosticHighlights?.filter((line: string) => !hasNumeric(line)),
    createDefaultDiagnosticHighlights(condition),
    DEFAULT_DIAGNOSTIC_HIGHLIGHTS
  );

  const diagnosticFromRow = toStringArray(
    (caseRow as Record<string, unknown>).diagnostic_findings
  );
  const diagnosticLabValueSources = [
    toStringArray((caseRow as Record<string, unknown>).lab_values),
    toStringArray((caseRow as Record<string, unknown>).labValues),
    toStringArray((caseRow as Record<string, unknown>).diagnostic_values),
    details.labValues ?? [],
    diagnosticFromRow,
  overrides.diagnosticHighlights?.filter((line: string) => hasNumeric(line)) ?? [],
  ];

  const diagnosticLabValues = pickFirstNonEmpty(
    dedupeLines(
      diagnosticLabValueSources.flat().filter((line) => hasNumeric(line))
    ),
    getConditionLabDefaults(condition, species),
    DEFAULT_DIAGNOSTIC_LAB_VALUES
  );

  return {
    ownerName,
    animalName,
    patientDescriptor,
    setting,
    presentingComplaint,
    duration,
    environmentSummary,
    learningObjectives,
    physicalExamVitals,
    physicalExamFindings,
    diagnosticHighlights: diagnosticInstructions,
    diagnosticLabValues,
  };
};

interface GenerationContext {
  caseId: string;
  field: CaseAutomationField;
  summary: string;
  species: string;
  condition: string;
  title: string;
  persona: PersonaData;
}

const buildGenerationContext = (
  caseId: string,
  field: CaseAutomationField,
  caseRow: CaseRow
): GenerationContext | null => {
  const details = parseCaseDetails(caseRow.details);
  const summary =
    stringField(caseRow.description) ||
    stringField(details.presentingComplaint);
  const species = stringField(caseRow.species);
  const condition = stringField(caseRow.condition);
  const persona = resolvePersonaData(caseId, caseRow, summary, species, condition);

  return {
    caseId,
    field,
    summary,
    species,
    condition,
    title: stringField(caseRow.title),
    persona,
  };
};

const getGenerationContext = (
  definition: PromptDefinition,
  caseRow: CaseRow
): GenerationContext | null => {
  const caseId = definition.caseId;
  const field = definition.caseField;
  if (!caseId || !field) {
    return null;
  }

  if (!CASE_AUTOMATION_FIELD_SET.has(field as CaseAutomationField)) {
    return null;
  }

  return buildGenerationContext(caseId, field as CaseAutomationField, caseRow);
};

const join = (...parts: (string | undefined | null)[]): string =>
  parts
    .flatMap((part) => {
      if (!part) return [];
      return part.split(/\r?\n/g);
    })
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();

function generateDetailsJson(ctx: GenerationContext): string {
  const { persona, summary, species, condition } = ctx;

  const payload: Record<string, unknown> = {
    presenting_complaint:
      persona.presentingComplaint || summary || undefined,
    duration: persona.duration || undefined,
    setting: persona.setting || undefined,
    environment: persona.environmentSummary || undefined,
    species: species || undefined,
    primary_condition: condition || undefined,
    learning_objectives:
      persona.learningObjectives && persona.learningObjectives.length > 0
        ? persona.learningObjectives
        : undefined,
  };

  for (const key of Object.keys(payload)) {
    const value = payload[key];
    if (
      value === undefined ||
      (typeof value === "string" && value.trim() === "") ||
      (Array.isArray(value) && value.length === 0)
    ) {
      delete payload[key];
    }
  }

  return JSON.stringify(payload, null, 2);
}

function generatePhysicalExamFindingsContent(ctx: GenerationContext): string {
  const { persona } = ctx;
  const vitals = persona.physicalExamVitals;
  const findings = persona.physicalExamFindings;

  return join(
    "Vital signs:",
    ...vitals.map((line) => `- ${line}`),
    findings.length ? "Key findings:" : undefined,
    ...findings.map((line) => `- ${line}`),
    `Context: Findings collected while evaluating ${persona.animalName}, ${persona.patientDescriptor}.`
  );
}

function buildDiagnosticFooterLine(
  persona: PersonaData,
  copy: DiagnosticPromptCopy
): string | undefined {
  const prefix = copy.footerPrefix.trim();
  const suffix = copy.footerSuffix.trim();

  if (!prefix && !suffix) {
    return undefined;
  }

  const middle = persona.animalName.trim() || "the patient";
  const prefixWithSpace = prefix.length > 0 ? `${prefix} ${middle}` : middle;
  return `${prefixWithSpace}${suffix}`.trim();
}

function generateDiagnosticFindingsContent(
  ctx: GenerationContext,
  copy: DiagnosticPromptCopy = DEFAULT_DIAGNOSTIC_PROMPT_COPY
): string {
  const { persona } = ctx;
  const highlights = persona.diagnosticHighlights;

  const header = copy.header.trim();
  const footer = buildDiagnosticFooterLine(persona, copy);

  return join(
    header ? header : undefined,
    ...highlights.map((line) => `- ${line}`),
    footer
  );
}

function generateOwnerBackground(ctx: GenerationContext): string {
  const { persona, summary, condition, species } = ctx;
  return join(
    `Role: ${persona.ownerName}, caretaker of ${persona.animalName} (${persona.patientDescriptor}).`,
    `Setting: ${persona.setting}.`,
    summary ? `Learner-facing summary reference: ${summary}` : undefined,
    condition ? `Primary clinical focus: ${condition}.` : undefined,
    species ? `Species context: ${species}.` : undefined,
    `Tone guidelines:`,
    `- Open anxious about the current symptoms but soften once the clinician outlines a plan.`,
    `- Share only information the learner requests.`,
    `- Keep explanations practical and free of medical jargon unless the student introduces terms first.`,
    `- Support biosecurity or home-care planning when asked, acknowledging the real-world constraints of the setting.`,
    `If the learner reassures ${persona.ownerName}, shift toward a collaborative problem-solving tone and avoid repeating the initial worry.`
  );
}

function generateHistoryFeedback(ctx: GenerationContext): string {
  const { persona, summary, condition, species } = ctx;
  return join(
    `You are an experienced veterinary educator reviewing the learner's history-taking performance for ${persona.animalName}.`,
    summary ? `Scenario reminder: ${summary}` : undefined,
    condition ? `Primary condition under investigation: ${condition}.` : undefined,
    species ? `Species considerations: ${species}.` : undefined,
    `Begin with strengths, then list the top unanswered questions. Focus on:`,
    `1. Presenting complaint timeline, progression, and severity.`,
    `2. Exposure risks, environment (${persona.setting}), and other animals potentially affected.`,
    `3. Preventive care status, prior illnesses, and relevant treatments.`,
    `4. Nutrition, medications, and management routines that impact the case.`,
    `Provide clear, actionable follow-ups the learner should ask next.`
  );
}

function generateOwnerFollowUp(ctx: GenerationContext): string {
  const { persona, condition, summary } = ctx;
  return join(
    `Role: ${persona.ownerName}, owner of ${persona.animalName}.`,
    summary ? `Current understanding: ${summary}` : undefined,
    condition ? `${persona.ownerName} wants to understand how proposed diagnostics relate to ${condition.toLowerCase()}.` : undefined,
    `Conversation goals:`,
    `- Ask why each diagnostic or treatment step is necessary.`,
    `- Query costs, logistics, and patient comfort.`,
    `- Raise practical concerns about implementing the plan in ${persona.setting}.`,
    `- Become cooperative once the learner explains the rationale clearly.`
  );
}

function generateOwnerFollowUpFeedback(ctx: GenerationContext): string {
  const { persona, condition } = ctx;
  return join(
    `When scoring the follow-up discussion, evaluate whether the learner:`,
    `- Linked each diagnostic recommendation to the suspected ${condition || "clinical focus"}.`,
    `- Explained purpose, cost, and logistics in language ${persona.ownerName} could relay to others.`,
    `- Addressed biosecurity or home-care considerations relevant to ${persona.setting}.`,
    `- Invited and handled ${persona.ownerName}'s questions respectfully.`,
    `Offer two specific action items that would elevate the conversation.`
  );
}

function generateOwnerDiagnosis(ctx: GenerationContext): string {
  const { persona, condition } = ctx;
  return join(
    `Diagnosis stage for ${persona.animalName}.`,
    condition ? `${persona.ownerName} is hearing confirmation of ${condition}.` : undefined,
    `Initial reaction: mix of relief and concern—ask about prognosis, monitoring, and immediate next steps.`,
    `Follow-up questions should explore timelines for recovery, impact on other animals or people, and any long-term implications.`,
    `If the learner provides clear answers, transition toward planning and compliance.`
  );
}

function generateOwnerPrompt(ctx: GenerationContext): string {
  const { persona, condition } = ctx;
  return join(
    `You are roleplaying as ${persona.ownerName}, caretaker of ${persona.animalName}.`,
    `Stay grounded in lived experience within ${persona.setting}.`,
    condition
      ? `Frame concerns around the suspected ${condition.toLowerCase()} while remaining open to the clinician's guidance.`
      : undefined,
    `Only volunteer information that the learner specifically requests.`,
    `Use everyday language, ask clarifying questions, and avoid offering your own medical diagnoses.`
  );
}

function generateHistoryFeedbackPrompt(ctx: GenerationContext): string {
  const { summary, condition } = ctx;
  return join(
    `IMPORTANT - FIRST CHECK FOR MINIMAL INTERACTION:`,
    `1. If the learner contributed fewer than three substantive messages, provide guidance urging them to gather more data before requesting feedback.`,
    `2. When interaction is sufficient, deliver structured feedback following the rubric below.`,
    summary ? `Scenario summary: ${summary}` : undefined,
    condition ? `Primary condition focus: ${condition}.` : undefined,
    `Feedback rubric:`,
    `- Highlight strengths in question sequencing and rapport.`,
    `- Identify crucial gaps (exposure risks, preventive care, systemic review).`,
    `- Suggest specific follow-up questions to close those gaps.`,
    `- Reinforce how thorough history-taking supports timely diagnosis and management.`
  );
}

function generatePhysicalExamPrompt(ctx: GenerationContext): string {
  const { persona } = ctx;
  return join(
    `You are ${VETERINARY_ASSISTANT_NAME}, the veterinary assistant helping examine ${persona.animalName}.`,
    `Provide ONLY the specific vital sign or system finding the learner requests.`,
    `If they ask broadly, prompt them to clarify which parameter they need.`,
    `Use clinical language and remind the learner when a body system was unremarkable.`
  );
}

function generateDiagnosticPrompt(ctx: GenerationContext): string {
  const { persona } = ctx;
  return join(
    `You are ${LAB_TECHNICIAN_NAME}, the laboratory technician supporting diagnostics for ${persona.animalName}.`,
    `Share one requested result at a time (laboratory, imaging, point-of-care).`,
    `If a test has not been run, state that it is pending or unavailable.`,
    `Avoid interpreting results—deliver precise data only.`
  );
}

function generateOwnerFollowUpPrompt(ctx: GenerationContext): string {
  const { persona, condition } = ctx;
  return join(
    `You are ${persona.ownerName} discussing next diagnostic or management steps for ${persona.animalName}.`,
    condition ? `Seek justification for each recommendation tied to ${condition}.` : undefined,
    `Ask about cost, practicality, and the impact on day-to-day routines in ${persona.setting}.`,
    `Acknowledge thorough explanations and shift toward planning once reassured.`
  );
}

function generateOwnerFollowUpFeedbackPrompt(ctx: GenerationContext): string {
  const { persona, condition } = ctx;
  return join(
    `When evaluating the learner's follow-up conversation, consider whether they:`,
    `- Prioritised diagnostics relevant to the suspected ${condition || "condition"}.`,
    `- Explained isolation, safety, or monitoring requirements in terms ${persona.ownerName} can execute.`,
    `- Balanced empathy with clear next steps and checked for understanding.`,
    `- Invited financial or logistical questions and responded constructively.`
  );
}

function generateOwnerDiagnosisPrompt(ctx: GenerationContext): string {
  const { persona, condition } = ctx;
  return join(
    `You are ${persona.ownerName} receiving diagnostic results for ${persona.animalName}.`,
    condition ? `Wait for the learner to confirm ${condition} before referencing it by name.` : undefined,
    `Begin concerned but composed, then focus on practical questions about treatment, monitoring, and protecting other animals or people.`,
    `Acknowledge clear explanations and ask for clarification when details are missing.`
  );
}

function generateOverallFeedbackPrompt(ctx: GenerationContext): string {
  const { summary, condition, persona, species } = ctx;
  return join(
    `Provide a comprehensive teaching summary for the case involving ${persona.animalName}.`,
    summary ? `Learner-facing summary: ${summary}` : undefined,
    species ? `Species: ${species}.` : undefined,
    condition ? `Primary condition: ${condition}.` : undefined,
    `Structure the feedback as follows:`,
    `1. Overall assessment (200-300 words) highlighting strengths, growth areas, and diagnostic reasoning.`,
    `2. Stage-by-stage commentary (history, examination, diagnostics, client communication, treatment planning).`,
    `3. Skills ratings (Excellent/Good/Satisfactory/Needs Improvement/Unsatisfactory) for reasoning, diagnostics, biosecurity or nursing considerations, empathy, and overall management.`,
    `4. Key learning points (3-5 bullets) tailored to this case.`,
    `5. Actionable recommendations (3-5 items) the learner should pursue next.`,
    `Be honest yet encouraging, citing concrete examples from the interaction.`
  );
}

export interface CasePromptAutomationOptions {
  diagnosticCopy?: DiagnosticPromptCopy;
  usePapers?: boolean;
  paperTopK?: number;
}

export function generateCaseFieldContent(
  definition: PromptDefinition,
  caseRow: CaseRow,
  options: CasePromptAutomationOptions = {}
): string | null {
  const ctx = getGenerationContext(definition, caseRow);
  if (!ctx) {
    return null;
  }
  return generateCaseFieldContentForCaseField(
    ctx.caseId,
    ctx.field,
    caseRow,
    options
  );
}

export async function generateCaseFieldContentAsync(
  definition: PromptDefinition,
  caseRow: CaseRow,
  options: CasePromptAutomationOptions = {}
): Promise<string | null> {
  const ctx = getGenerationContext(definition, caseRow);
  if (!ctx) {
    return null;
  }
  return generateCaseFieldContentForCaseFieldAsync(
    ctx.caseId,
    ctx.field,
    caseRow,
    options
  );
}

export function isCaseFieldAutomatable(field: string): field is CaseAutomationField {
  return CASE_AUTOMATION_FIELD_SET.has(field as CaseAutomationField);
}

export function generateCaseFieldContentForCaseField(
  caseId: string,
  field: CaseAutomationField,
  caseRow: CaseRow,
  options: CasePromptAutomationOptions = {}
): string | null {
  const ctx = buildGenerationContext(caseId, field, caseRow);
  if (!ctx) {
    return null;
  }

  switch (field) {
    case "details":
      return generateDetailsJson(ctx);
    case "physical_exam_findings":
      return generatePhysicalExamFindingsContent(ctx);
    case "diagnostic_findings":
      return generateDiagnosticFindingsContent(
        ctx,
        options.diagnosticCopy ?? DEFAULT_DIAGNOSTIC_PROMPT_COPY
      );
    case "owner_background":
      return generateOwnerBackground(ctx);
    case "history_feedback":
      return generateHistoryFeedback(ctx);
    case "owner_follow_up":
      return generateOwnerFollowUp(ctx);
    case "owner_follow_up_feedback":
      return generateOwnerFollowUpFeedback(ctx);
    case "owner_diagnosis":
      return generateOwnerDiagnosis(ctx);
    case "get_owner_prompt":
      return generateOwnerPrompt(ctx);
    case "get_history_feedback_prompt":
      return generateHistoryFeedbackPrompt(ctx);
    case "get_physical_exam_prompt":
      return generatePhysicalExamPrompt(ctx);
    case "get_diagnostic_prompt":
      return generateDiagnosticPrompt(ctx);
    case "get_owner_follow_up_prompt":
      return generateOwnerFollowUpPrompt(ctx);
    case "get_owner_follow_up_feedback_prompt":
      return generateOwnerFollowUpFeedbackPrompt(ctx);
    case "get_owner_diagnosis_prompt":
      return generateOwnerDiagnosisPrompt(ctx);
    case "get_overall_feedback_prompt":
      return generateOverallFeedbackPrompt(ctx);
    default:
      return null;
  }
}

async function fetchPaperSummaries(
  caseId: string,
  query: string,
  topK = 3
): Promise<string[] | null> {
  try {
    const base =
      process.env.NEXT_PUBLIC_BASE_URL || process.env.BASE_URL || "http://localhost:3000";
    const url = `${base.replace(/\/$/, "")}/api/cases/${caseId}/papers/query`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, summarize: true, top_k: topK }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !Array.isArray(data.results)) return null;
    return data.results.map((r: any) => r.summary || r.excerpt || r.title).filter(Boolean);
  } catch (e) {
    return null;
  }
}

export async function generateCaseFieldContentForCaseFieldAsync(
  caseId: string,
  field: CaseAutomationField,
  caseRow: CaseRow,
  options: CasePromptAutomationOptions = {}
): Promise<string | null> {
  const ctx = buildGenerationContext(caseId, field, caseRow);
  if (!ctx) return null;

  let base = generateCaseFieldContentForCaseField(caseId, field, caseRow, options);
  if (!base) return null;

  const usePapers = !!options.usePapers;
  if (!usePapers) return base;

  // If no media or no documents attached, return base
  const media = Array.isArray(caseRow.media) ? caseRow.media : [];
  const hasDocs = media.some((m) => m && typeof m === "object" && (m.type === "document" || /pdf|docx|paper/i.test(String(m.contentType || m.mime || m.type || ""))));
  if (!hasDocs) return base;

  const queryText = ctx.summary || ctx.condition || ctx.title || "";
  const topK = typeof options.paperTopK === "number" ? options.paperTopK : 3;
  const summaries = await fetchPaperSummaries(ctx.caseId, queryText, topK);
  if (!summaries || summaries.length === 0) return base;

  const paperSection = ["Reference papers (brief summaries):"].concat(
    summaries.map((s) => `- ${s}`)
  ).join("\n");

  return `${paperSection}\n\n${base}`;
}
