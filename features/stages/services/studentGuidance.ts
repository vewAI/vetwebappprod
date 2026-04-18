import { classifyStageForTip } from "./stageService";

export type StageGuidance = {
  title: string;
  whatToDo: string;
  tips: string[];
};

const STUDENT_GUIDANCE: Record<string, StageGuidance> = {
  history: {
    title: "History Taking",
    whatToDo:
      "Ask the owner open-ended questions about the animal's symptoms, timeline, diet, environment, and previous medical history. Build a complete clinical picture before moving on.",
    tips: [
      "Start with broad open-ended questions, then narrow down",
      "Ask about onset, duration, and progression of symptoms",
      "Cover diet, environment, vaccination, and deworming status",
      "Explore any recent changes in behavior, appetite, or activity",
      "Ask about contact with other animals or travel history",
    ],
  },
  physical: {
    title: "Physical Examination",
    whatToDo:
      "Request specific physical exam findings from the nurse. Ask about vitals and each body system you want to examine. Be systematic — don't skip systems.",
    tips: [
      "Start with vitals: temperature, heart rate, respiratory rate, CRT",
      "Request findings system by system (cardiac, respiratory, abdominal, etc.)",
      "Be specific — ask for 'abdominal palpation findings' not 'anything else?'",
      "Note any abnormal values and correlate with history",
      "Don't forget lymph nodes, mucous membranes, and hydration status",
    ],
  },
  diagnostics: {
    title: "Diagnostic Planning",
    whatToDo:
      "Explain to the owner which diagnostic tests you want to run and why. Discuss costs, logistics, and what each test will reveal.",
    tips: [
      "Explain your reasoning for each test you're recommending",
      "Discuss approximate costs and timelines with the owner",
      "Prioritize tests based on clinical suspicion",
      "Address the owner's concerns about the animal's comfort during testing",
    ],
  },
  lab: {
    title: "Laboratory & Diagnostics",
    whatToDo:
      "Request specific test results from the lab technician. Ask for one category at a time (CBC, biochemistry, imaging, etc.) and interpret the values.",
    tips: [
      "Request results by specific category: 'CBC', 'biochemistry', 'urinalysis'",
      "Don't ask for 'all results' — be methodical, one test at a time",
      "Note which values are outside normal ranges",
      "Compare findings with your physical exam observations",
      "Consider follow-up tests based on initial results",
    ],
  },
  plan: {
    title: "Treatment Plan",
    whatToDo:
      "Give the nurse specific treatment instructions: medications (drug, dose, route, frequency), fluids, monitoring parameters, and nursing care orders.",
    tips: [
      "Specify drug name, dose, route, and frequency for each medication",
      "Include fluid therapy details if needed (type, rate, duration)",
      "Define monitoring parameters and reassessment schedule",
      "Consider addressing the underlying cause, not just symptoms",
    ],
  },
  communication: {
    title: "Client Communication",
    whatToDo:
      "Explain to the owner the treatment you are giving the animal and why, the prognosis, what to expect, and expected timelines. Be empathetic and use plain language.",
    tips: [
      "Explain each treatment and why it's necessary in simple terms",
      "Discuss the prognosis — best case, worst case, and most likely outcome",
      "Give a realistic timeline for recovery and what milestones to watch for",
      "Provide clear home care instructions and warning signs that require urgent return",
      "Address costs, follow-up visits, and long-term management honestly",
    ],
  },
};

export function getStudentGuidance(
  stageTitle?: string,
  stageDescription?: string,
): StageGuidance | null {
  const key = classifyStageForTip(stageTitle, stageDescription);
  return STUDENT_GUIDANCE[key] ?? null;
}
