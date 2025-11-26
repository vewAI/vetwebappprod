import OpenAi from "openai";
import type { CaseFieldKey } from "@/features/cases/fieldMeta";

export type CasePayload = Record<string, unknown>;

type MergeOptions = {
  appendStrings?: boolean;
  species?: string | null;
};

const SPECIES_KEYWORDS: Record<string, string[]> = {
  equine: [
    "horse",
    "equine",
    "mare",
    "stallion",
    "gelding",
    "foal",
    "filly",
    "colt",
  ],
  bovine: ["cow", "bovine", "cattle", "heifer", "bull", "calf", "dairy"],
  canine: ["dog", "canine", "puppy", "bitch"],
  feline: ["cat", "feline", "kitten", "queen", "tom"],
  ovine: ["sheep", "ovine", "ewe", "ram", "lamb"],
  caprine: ["goat", "caprine", "doe", "buck", "kid"],
  porcine: ["pig", "porcine", "swine", "hog", "boar", "sow", "gilt"],
  camelid: ["alpaca", "llama", "camel", "camelid"],
  avian: ["bird", "avian", "chicken", "hen", "rooster", "duck", "goose"],
};

const SPECIES_CANONICAL: Record<string, string> = {
  equine: "horse",
  bovine: "cow",
  canine: "dog",
  feline: "cat",
  ovine: "sheep",
  caprine: "goat",
  porcine: "pig",
  camelid: "camelid",
  avian: "bird",
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeSpeciesKey(species: string | null | undefined): string | null {
  const lower = species ? species.toLowerCase() : "";
  if (!lower) return null;
  for (const [key, synonyms] of Object.entries(SPECIES_KEYWORDS)) {
    if (synonyms.some((word) => lower.includes(word))) {
      return key;
    }
  }
  return null;
}

function detectSpeciesKeyFromText(text: string): string | null {
  const lower = text.toLowerCase();
  for (const [key, synonyms] of Object.entries(SPECIES_KEYWORDS)) {
    if (synonyms.some((word) => lower.includes(word))) {
      return key;
    }
  }
  return null;
}

function coerceStringToSpecies(value: string, targetKey: string): string {
  let updated = value;
  const replacement = SPECIES_CANONICAL[targetKey] ?? targetKey;
  for (const [key, synonyms] of Object.entries(SPECIES_KEYWORDS)) {
    if (key === targetKey) continue;
    for (const word of synonyms) {
      const regex = new RegExp(`\\b${escapeRegExp(word)}\\b`, "gi");
      updated = updated.replace(regex, replacement);
    }
  }
  return updated;
}

export function scrubConflictingSpeciesStrings(
  body: CasePayload,
  species: string | null | undefined
) {
  const targetKey = normalizeSpeciesKey(species);
  if (!targetKey) return;
  for (const [key, value] of Object.entries(body)) {
    if (typeof value !== "string") continue;
    const detected = detectSpeciesKeyFromText(value);
    if (detected && detected !== targetKey) {
      const coerced = coerceStringToSpecies(value, targetKey);
      const coercedKey = detectSpeciesKeyFromText(coerced);
      body[key] = !coercedKey || coercedKey === targetKey ? coerced : "";
    }
  }
}

function ensureField(
  body: CasePayload,
  key: CaseFieldKey,
  value: string | Record<string, unknown>
) {
  const current = body[key];
  if (
    current === undefined ||
    current === null ||
    (typeof current === "string" && current.trim() === "")
  ) {
    body[key] = value;
  }
}

export function applyCaseDefaults(body: CasePayload) {
  const patientName = String(body["title"] ?? body["id"] ?? "the patient");

  const species = String(body["species"] ?? "").trim();
  const speciesLower = species.toLowerCase();
  const condition = String(body["condition"] ?? "").trim();
  const conditionLower = condition.toLowerCase();
  const ownerLabel = species
    ? `${species} owner`
    : "Animal owner";
  const patientLabel = species || "patient";
  const conditionDescription =
    condition || "their current medical concern";

  const diagnostic_findings_template =
    "Share diagnostic results only for investigations the learner specifically ordered. When a requested test is inappropriate or unavailable, explain why and suggest more suitable options.";

  const description_template = String(body["title"] ?? "")
    ? `${String(body["title"])} – ${condition || "clinical summary"}`
    : `A ${patientLabel.toLowerCase()} presenting for ${conditionDescription}.`;

  const details_template: Record<string, unknown> = {
    presenting_complaint: String(
      body["description"] ?? `Presenting for ${conditionDescription}`
    ),
    duration: body["estimated_time"]
      ? `${body["estimated_time"]} minutes`
      : "Unknown",
    learning_objectives: "Add learning objectives relevant to this scenario.",
  };

  let difficulty_template = "Easy";
  if (
    /severe|shock|critical|collapse|fracture|laminitis|sepsis|er/i.test(
      conditionLower
    )
  ) {
    difficulty_template = "Hard";
  } else if (/moderate|chronic|recurring|suspected/i.test(conditionLower)) {
    difficulty_template = "Medium";
  }

  const estimated_time_template = 15;

  let physical_exam_findings_template =
    `Provide vital signs and pertinent positive/negative findings for this ${patientLabel.toLowerCase()}. Include details that align with ${conditionDescription}.`;
  if (speciesLower.includes("horse") || speciesLower.includes("equine")) {
    physical_exam_findings_template =
      "List physical exam findings for an equine patient, highlighting abnormalities relevant to the suspected diagnosis.";
  }

  const owner_background_template = `Role: ${ownerLabel} (describe personality, communication style, and concerns)\nPatient: ${patientName}${
    species ? ` (${species})` : ""
  }\n\nProvide a concise backstory that references the present complaint and the animal's daily context. Include guidance on what information the owner will volunteer versus withhold unless asked. Maintain consistent names already present in the case.`;

  const history_feedback_template = `Offer structured feedback on the learner's history-taking. Highlight strengths first, then list missing critical questions relating to ${conditionDescription}. Suggest follow-up questions the learner could ask.`;

  const owner_follow_up_template = `Role: ${ownerLabel} seeking clarity after the initial assessment. Respond with empathy and curiosity about next steps that address ${conditionDescription}. Reinforce financial or emotional considerations mentioned in the case.`;

  const owner_follow_up_feedback_template = `Assess how well the learner explained diagnostics and planning around ${conditionDescription}. Comment on clarity, prioritisation, and client communication.`;

  const owner_diagnosis_template = `Describe how the owner reacts when the diagnosis related to ${conditionDescription} is explained. Include likely questions about prognosis, costs, and at-home care.`;

  const get_owner_prompt_template = `You are roleplaying as ${patientName}'s ${ownerLabel}. Stay in character, answer succinctly, and volunteer only information consistent with the case details unless asked.`;

  const get_history_feedback_prompt_template = `Provide targeted feedback on history-taking for this ${patientLabel.toLowerCase()} case involving ${conditionDescription}. Use the structured format requested by the UI.`;

  const get_physical_exam_prompt_template = `You are a veterinary professional reporting physical exam findings. Respond only when asked and use data appropriate for ${patientLabel.toLowerCase()} with ${conditionDescription}.`;

  const get_diagnostic_prompt_template = `You are a laboratory contact or diagnostic imaging specialist. Share results relevant to ${conditionDescription} and explain any limitations or follow-up recommendations.`;

  const get_owner_follow_up_prompt_template = `Continue roleplaying as the ${ownerLabel} during the follow-up conversation. Ask about the rationale for diagnostics and how recommendations relate to ${conditionDescription}.`;

  const get_owner_follow_up_feedback_prompt_template = `Evaluate the learner's follow-up discussion. Focus on how well they justified tests, addressed client concerns, and maintained rapport while discussing ${conditionDescription}.`;

  const get_owner_diagnosis_prompt_template = `Answer as the ${ownerLabel} when hearing the diagnosis. Respond emotionally in a way that matches the persona established for this case and the implications of ${conditionDescription}.`;

  const get_overall_feedback_prompt_template = `Summarise the learner's performance across all stages of this case, tying feedback back to ${conditionDescription} and the scenario details.`;

  ensureField(body, "description", description_template);
  ensureField(body, "details", details_template);

  if (
    body["estimated_time"] === undefined ||
    Number.isNaN(Number(body["estimated_time"]))
  ) {
    body["estimated_time"] = estimated_time_template;
  }

  ensureField(body, "difficulty", difficulty_template);
  ensureField(body, "physical_exam_findings", physical_exam_findings_template);
  ensureField(body, "diagnostic_findings", diagnostic_findings_template);
  ensureField(body, "owner_background", owner_background_template);
  ensureField(body, "history_feedback", history_feedback_template);
  ensureField(body, "owner_follow_up", owner_follow_up_template);
  ensureField(body, "owner_follow_up_feedback", owner_follow_up_feedback_template);
  ensureField(body, "owner_diagnosis", owner_diagnosis_template);
  ensureField(body, "get_owner_prompt", get_owner_prompt_template);
  ensureField(
    body,
    "get_history_feedback_prompt",
    get_history_feedback_prompt_template
  );
  ensureField(
    body,
    "get_physical_exam_prompt",
    get_physical_exam_prompt_template
  );
  ensureField(body, "get_diagnostic_prompt", get_diagnostic_prompt_template);
  ensureField(
    body,
    "get_owner_follow_up_prompt",
    get_owner_follow_up_prompt_template
  );
  ensureField(
    body,
    "get_owner_follow_up_feedback_prompt",
    get_owner_follow_up_feedback_prompt_template
  );
  ensureField(
    body,
    "get_owner_diagnosis_prompt",
    get_owner_diagnosis_prompt_template
  );
  ensureField(
    body,
    "get_overall_feedback_prompt",
    get_overall_feedback_prompt_template
  );
}

export async function enrichCaseWithModel(
  body: CasePayload,
  openai: OpenAi
): Promise<CasePayload> {
  const species = typeof body["species"] === "string" ? body["species"] : "";
  const condition = typeof body["condition"] === "string" ? body["condition"] : "";
  const patientName = typeof body["title"] === "string" ? body["title"] : "";

  const guardRails = [
    "Use the provided JSON as the single source of truth for this specific case.",
    "Preserve existing proper nouns (animal names, owner names, locations, facilities) and keep personas consistent with the source data.",
    species
      ? `Ensure every description, finding, and persona interaction reflects a ${species}.`
      : "Match species-specific details to the information present in the case.",
    species
      ? `Do not reference other species (e.g., horses, dogs, cats) while writing about a ${species}.`
      : "Avoid introducing species that are not part of the case context.",
    condition
      ? `Tie the narrative, diagnostics, and feedback to the condition: ${condition}.`
      : "Base clinical reasoning on the symptoms and details already present.",
    patientName
      ? `Keep references to the patient aligned with the existing name/title: ${patientName}.`
      : "Introduce patient descriptors consistent with the data provided.",
    "Avoid copying stock text from unrelated example cases. Instead, expand the learner experience using the case's own facts.",
  ]
    .filter(Boolean)
    .join(" ");

  const promptSystem =
    "You are an expert veterinary educator and clinician. Given a partially-filled case record in JSON, expand and complete each field to produce a high-quality, evidence-informed, educational case. Use clear clinical language suitable for students and make the case a challenging but fair learning scenario. Return a single JSON object containing the expanded fields (only JSON, no commentary). Respond using up-to-date veterinary reasoning and include clinically-relevant physical exam findings, likely diagnostic considerations, and concise owner background and role prompts suitable for a simulated owner. Do not include explanatory text outside the JSON. " +
    guardRails;

  const userContent = JSON.stringify(body);

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: promptSystem },
      { role: "user", content: userContent },
    ],
    temperature: 0.2,
    max_tokens: 1200,
  });

  const content = String(completion.choices?.[0]?.message?.content ?? "");

  if (!content.trim()) {
    return {};
  }

  try {
    return JSON.parse(content) as CasePayload;
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]) as CasePayload;
      } catch {
        return {};
      }
    }
  }

  return {};
}

export function mergeAugmentedFields(
  base: CasePayload,
  augment: CasePayload,
  options: MergeOptions = {}
): CasePayload {
  const { appendStrings = false, species = null } = options;
  const targetSpeciesKey = normalizeSpeciesKey(species);
  const result: CasePayload = { ...base };

  for (const key of Object.keys(augment)) {
    const nextValue = augment[key];
    if (
      nextValue === undefined ||
      nextValue === null ||
      (typeof nextValue === "string" && nextValue.trim() === "")
    ) {
      continue;
    }

    if (typeof nextValue === "string") {
      let candidate = nextValue.trim();
      if (!candidate) continue;

      if (targetSpeciesKey) {
        const nextSpeciesKey = detectSpeciesKeyFromText(candidate);
        if (nextSpeciesKey && nextSpeciesKey !== targetSpeciesKey) {
          const coerced = coerceStringToSpecies(candidate, targetSpeciesKey).trim();
          const coercedKey = detectSpeciesKeyFromText(coerced);
          if (!coercedKey || coercedKey === targetSpeciesKey) {
            candidate = coerced;
          } else {
            console.warn(
              `Skipping conflicting species content for field ${key}; expected ${targetSpeciesKey}, received ${nextSpeciesKey}`
            );
            continue;
          }
        }
      }

      if (appendStrings && typeof result[key] === "string") {
        let existing = String(result[key]).trim();
        if (targetSpeciesKey && existing) {
          const existingSpeciesKey = detectSpeciesKeyFromText(existing);
          if (existingSpeciesKey && existingSpeciesKey !== targetSpeciesKey) {
            existing = coerceStringToSpecies(existing, targetSpeciesKey).trim();
          }
        }

        if (!existing) {
          result[key] = candidate;
          continue;
        }

        if (candidate.includes(existing) || existing.includes(candidate)) {
          result[key] = candidate.length >= existing.length ? candidate : existing;
          continue;
        }

        result[key] = `${existing}\n\n${candidate}`;
        continue;
      }

      result[key] = candidate;
      continue;
    }

    result[key] = nextValue;
  }

  return result;
}
