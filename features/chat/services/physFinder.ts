// Pure helpers for parsing requested physical exam keys and matching them
// against case `physical_exam_findings` text.

export type RequestedKeys = {
  raw: string;
  tokens: string[];
  canonical: string[];
};

export type PhysMatchResult = {
  canonicalKey: string;
  aliases: string[];
  lines: string[];
};

const ALIAS_MAP: Record<string, string[]> = {
  heart_rate: ["hr", "heart rate", "heartbreak", "how great", "aaron", "age aaron", "h r", "h.r.", "hrr", "heartrate", "cardiac rate", "heart rhythm"],
  pulse: [
    "pulse",
    "pulses",
    "peripheral pulse",
    "peripheral pulses",
    "arterial pulse",
    "arterial pulses",
    "facial pulse",
    "transverse facial pulse",
    "submandibular pulse",
    "coccygeal pulse",
    "metatarsal pulse",
    "pulse quality",
    "pulse rate",
    "quality of pulse",
    "femoral pulse",
    "femoral pulses",
  ],
  respiratory_rate: ["rr", "respiratory rate", "respiration", "respirations", "resp rate", "resp", "breathing rate"],
  temperature: ["temp", "temperature", "t"],
  blood_pressure: ["bp", "blood pressure"],
  hydration: ["hydration", "skin tent", "skin turgor", "turgor"],
  mucous_membranes: [
    "mucous",
    "mucous membrane",
    "mucous membranes",
    "mm",
    "mm color",
    "mm colour",
    "gums",
    "gum color",
  ],
  capillary_refill_time: ["crt", "capillary refill", "capillary refill time"],
  abdomen: [
    "abdomen",
    "abdominal",
    "gastrointestinal borborygmi",
    "rumen",
    "rumen fill",
    "rumen motility",
    "rumen turnover",
    "percussion",
    "ping",
    "ballottement",
    "borborygmi",
    "gut sounds",
    "peristalsis",
  ],
  lymph_nodes: ["lymph nodes", "lymph node", "submandibular", "prescapular", "retropharyngeal", "popliteal"],
  demeanour: ["demeanour", "demeanor", "mentation", "attitude", "mental status", "posture"],
  thoracic_auscultation: ["lungs", "lung sounds", "heart sounds", "cardiac auscultation", "pulmonary", "chest auscultation"],
  auscultation: ["auscultation", "ausc", "stethoscope", "was quotation", "quotation"],
  rectal_palpation: ["rectal palpation", "rectal exam", "rectal palp", "rectal", "rectal examination", "feces", "faeces", "manure"],
  nasogastric_intubation: ["nasogastric intubation", "nasogastric tube", "ng tube", "nasogastric", "ngt"],
  abdominocentesis: ["abdominocentesis", "abdominal centesis", "abdo centesis", "abdo-centesis"],
  musculoskeletal: [
    "musculoskeletal",
    "muscles",
    "muscle",
    "muscle palpation",
    "palpate muscles",
    "palpating muscles",
    "palpating the muscles",
    "palpate the muscles",
    "epaxial",
    "gluteal",
    "epaxial muscles",
    "gluteal muscles",
    "muscle tone",
    "muscle soreness",
    "muscle pain",
    "muscle stiffness",
    "cramping",
    "stiffness",
    "fasciculations",
    "muscle fasciculations",
    "limbs",
    "legs",
    "joints",
    "back",
    "epaxials",
    "gluteals",
  ],
  neurological: [
    "neurological",
    "neuro",
    "cranial nerves",
    "reflexes",
    "ataxia",
    "proprioception",
    "menace",
    "pupillary",
  ],
  eyes: [
    "eyes",
    "eye",
    "ocular",
    "ophthalmic",
    "pupils",
    "sclera",
    "cornea",
    "conjunctiva",
    "vision",
  ],
  skin: [
    "skin",
    "integument",
    "coat",
    "hair",
    "dermatological",
    "lesions",
    "alopecia",
    "pruritus",
  ],
  oral: [
    "oral",
    "oral cavity",
    "teeth",
    "mouth",
    "tongue",
    "pharynx",
  ],
  digital_pulse: [
    "digital pulse",
    "digital pulses",
    "palmar digital pulse",
    "plantar digital pulse",
    "digital arterial pulse",
    "hoof pulse",
    "hoof pulses",
    "foot pulse",
    "feet pulses",
    "bounding pulse",
    "bounding pulses",
    "bounding digital pulse",
    "bounding digital pulses",
  ],
};

// Group tokens map to multiple canonical keys
const GROUP_MAP: Record<string, string[]> = {
  vitals: ["heart_rate", "respiratory_rate", "temperature", "blood_pressure", "pulse"],
  vital: ["heart_rate", "respiratory_rate", "temperature", "blood_pressure", "pulse"],
  exam: [
    "heart_rate",
    "pulse",
    "respiratory_rate",
    "temperature",
    "blood_pressure",
    "mucous_membranes",
    "capillary_refill_time",
    "hydration",
    "abdomen",
    "musculoskeletal",
    "digital_pulse",
  ],
};

const TOKEN_TO_CANONICAL: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  for (const [canon, aliases] of Object.entries(ALIAS_MAP)) {
    for (const a of aliases) {
      out[a] = canon;
    }
  }
  // also add single-letter and key clinical shortcuts
  out["hr"] = "heart_rate";
  out["rr"] = "respiratory_rate";
  out["aaron"] = "heart_rate";
  out["t"] = "temperature";
  out["bp"] = "blood_pressure";
  out["pulse"] = "pulse";
  out["pulses"] = "pulse";
  out["muscles"] = "musculoskeletal";
  out["muscle"] = "musculoskeletal";
  out["musculoskeletal"] = "musculoskeletal";
  out["palpate"] = "musculoskeletal";
  out["palpating"] = "musculoskeletal";
  out["palpation"] = "musculoskeletal";
  out["epaxial"] = "musculoskeletal";
  out["gluteal"] = "musculoskeletal";
  out["stiffness"] = "musculoskeletal";
  out["cramping"] = "musculoskeletal";
  out["neuro"] = "neurological";
  out["neurological"] = "neurological";
  out["eyes"] = "eyes";
  out["eye"] = "eyes";
  out["ocular"] = "eyes";
  out["skin"] = "skin";
  out["integument"] = "skin";
  out["teeth"] = "oral";
  out["mouth"] = "oral";
  out["digital"] = "digital_pulse";
  out["hoof"] = "digital_pulse";
  out["hooves"] = "digital_pulse";
  return out;
})();

function splitTokens(input: string): string[] {
  if (!input) return [];
  // Remove filler words and punctuation then split on comma/and/whitespace
  const cleaned = input
    .toLowerCase()
    // Strip common filler/request phrases so tokens focus on parameters
    .replace(/\b(please|please\s+tell|give|give\s+me|show|show\s+me|what is|what's|tell|tell\s+me|ok|okay|could you|can you|would you|um|uh|er|ah|me)\b/g, " ")
    .replace(/[()]/g, " ")
    .replace(/[^a-z0-9,\s/\-]/g, " ")
    .replace(/\band\b/g, ",");

  // Split by comma or whitespace (including newlines and carriage returns)
  const parts = cleaned
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  return parts;
}

export function parseRequestedKeys(text: string): RequestedKeys {
  const normText = (text || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ");
  const tokens = splitTokens(text || "");
  const canonical: string[] = [];
  if (/\b(?:physical|vital) (?:parameters|signs)\b/i.test(text)) {
    canonical.push(...GROUP_MAP.vitals);
  }

  // Multi-word phrase matching directly on text
  const hasDigitalPulsePhrase = /\b(?:digital|palmar|plantar|hoof|foot)\s+pulses?\b|\bbounding\s+(?:digital\s+)?pulses?\b/i.test(normText);
  if (hasDigitalPulsePhrase) {
    if (!canonical.includes("digital_pulse")) canonical.push("digital_pulse");
  }

  const hasPeripheralPulsePhrase = /\b(?:peripheral|arterial|facial|transverse\s+facial|submandibular|coccygeal|metatarsal|femoral)\s+pulses?\b|\bpulse\s+quality\b/i.test(normText);
  if (hasPeripheralPulsePhrase) {
    if (!canonical.includes("pulse")) canonical.push("pulse");
  }

  if (
    /\b(?:muscle|muscles|epaxial|gluteal)\b.*\b(?:palpation|pa;pation|tone|pain|soreness|stiffness|hard|firm|cramp|tender)\b|\b(?:palpate|palpating)\b.*\b(?:muscles?|epaxial|gluteals?)\b/i.test(
      (text || "").toLowerCase()
    )
  ) {
    if (!canonical.includes("musculoskeletal")) canonical.push("musculoskeletal");
  }

  for (const tok of tokens) {
    // Trim unit-like suffixes such as mmhg or /min
    const plain = tok.replace(/mmhg$/i, "").replace(/\/.*/g, "");
    // Expand group tokens (e.g., 'vitals')
    if (GROUP_MAP[plain]) {
      for (const g of GROUP_MAP[plain]) {
        if (!canonical.includes(g)) canonical.push(g);
      }
      continue;
    }
    if (TOKEN_TO_CANONICAL[plain]) {
      const c = TOKEN_TO_CANONICAL[plain];
      // If user said "digital pulse", do not map the bare token "pulse" to generic peripheral pulse
      if (c === "pulse" && hasDigitalPulsePhrase && !hasPeripheralPulsePhrase) {
        continue;
      }
      if (!canonical.includes(c)) canonical.push(c);
    } else {
      // try alias map: short aliases (<= 2 chars like "t", "hr", "rr", "bp") must be an
      // exact match to avoid false positives (e.g. single-letter "t" matching any word containing 't')
      for (const [canon, aliases] of Object.entries(ALIAS_MAP)) {
        const hit = aliases.some((a) => {
          const first = a.split(" ")[0];
          if (first.length <= 2) {
            return plain === first;
          }
          return plain === first || (first.length >= 4 && plain.startsWith(first));
        });
        if (hit) {
          if (canon === "pulse" && hasDigitalPulsePhrase && !hasPeripheralPulsePhrase) {
            continue;
          }
          if (!canonical.includes(canon)) canonical.push(canon);
          break;
        }
      }
    }
  }

  // Disambiguate digital_pulse vs heart_rate: if digital pulses was asked, don't leak heart rate unless asked
  if (canonical.includes("digital_pulse") && !/\b(?:heart|hr|cardiac|bpm)\b/i.test(normText)) {
    const hrIdx = canonical.indexOf("heart_rate");
    if (hrIdx !== -1) canonical.splice(hrIdx, 1);
  }

  // Disambiguate digital_pulse vs peripheral pulse:
  if (canonical.includes("digital_pulse") && !hasPeripheralPulsePhrase) {
    // If text only mentions digital pulse, do not leak peripheral pulse
    const stripped = normText.replace(/\b(?:digital|palmar|plantar|hoof|foot)\s+pulses?\b/g, "").trim();
    if (!/\bpulses?\b/i.test(stripped)) {
      const pIdx = canonical.indexOf("pulse");
      if (pIdx !== -1) canonical.splice(pIdx, 1);
    }
  }

  // Disambiguate heart_rate vs pulse: if heart rate was asked without pulses, don't leak pulse
  if (canonical.includes("heart_rate") && !/\bpulses?\b/i.test(normText)) {
    const pIdx = canonical.indexOf("pulse");
    if (pIdx !== -1) canonical.splice(pIdx, 1);
    const dpIdx = canonical.indexOf("digital_pulse");
    if (dpIdx !== -1) canonical.splice(dpIdx, 1);
  }

  return { raw: text, tokens, canonical };
}

export function matchPhysicalFindings(requested: RequestedKeys, findingsText: string): PhysMatchResult[] {
  const lines = (findingsText || "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const results: PhysMatchResult[] = [];

  for (const canon of requested.canonical) {
    const aliases = ALIAS_MAP[canon] ?? [];
    const matched: string[] = [];
    const loweredAliases = aliases.map((a) => a.toLowerCase());

    for (const line of lines) {
      const low = line.toLowerCase();
      // match if any alias appears as a whole phrase or as a substring to be tolerant
      // of ASR mis-transcriptions (e.g., 'was quotation' -> auscultation)
      if (
        loweredAliases.some((alias) => low.includes(alias)) ||
        loweredAliases.some((alias) => low.includes(alias.split(" ")[0]))
      ) {
        matched.push(line);
      }
    }

    results.push({ canonicalKey: canon, aliases, lines: matched });
  }

  return results;
}

export const PHYS_SYNONYMS: Record<string, string[]> = {
  rumen_turnover: ["rumen turnover", "rumen_turnover"],
  rumen_turnover_alt: [
    "rumen-turnover",
    "rumen turnover",
    "rumen_turnover",
  ],
  ballottement: ["ballottement", "ballottement was", "ballott"],
  temperature: ["temp", "temperature"],
  heart_rate: ["heart rate", "aaron", "age aaron", "hr", "heartrate", "cardiac rate", "heart rhythm"],
  pulse: [
    "pulse",
    "pulses",
    "peripheral pulse",
    "peripheral pulses",
    "arterial pulse",
    "arterial pulses",
    "facial pulse",
    "transverse facial pulse",
    "submandibular pulse",
    "pulse quality",
    "pulse rate",
  ],
  respiratory_rate: ["respiratory rate", "respiration", "respirations", "resp rate", "resp", "rr"],
  mucous_membranes: [
    "mucous",
    "mucous membrane",
    "mucous membranes",
    "mm",
    "mm color",
    "mm colour",
  ],
  capillary_refill_time: ["crt", "capillary refill", "capillary refill time"],
  hydration: ["hydration", "skin tent", "skin turgor", "turgor"],
  abdomen: [
    "abdomen",
    "abdominal",
    "gastrointestinal borborygmi",
    "rumen",
    "rumen fill",
    "rumen motility",
    "rumen turnover",
    "percussion",
    "ping",
    "ballottement",
    "borborygmi",
    "gut sounds",
  ],
  lymph_nodes: ["lymph nodes", "lymph node", "submandibular", "prescapular", "retropharyngeal"],
  demeanour: ["demeanour", "demeanor", "mentation", "attitude", "mental status"],
  thoracic_auscultation: ["lungs", "lung sounds", "heart sounds", "cardiac auscultation", "respiratory auscultation", "pulmonary", "chest auscultation"],
  rectal_palpation: ["rectal palpation", "rectal exam", "rectal palp", "rectal", "feces", "faeces", "manure"],
  nasogastric_intubation: ["nasogastric intubation", "nasogastric tube", "ng tube", "ngt", "nasogastric"],
  abdominocentesis: ["abdominocentesis", "abdominal centesis", "abdo centesis"],
  musculoskeletal: [
    "musculoskeletal",
    "muscles",
    "muscle",
    "muscle palpation",
    "palpating muscles",
    "palpate muscles",
    "palpating the muscles",
    "palpate the muscles",
    "epaxial",
    "gluteal",
    "epaxial muscles",
    "gluteal muscles",
    "muscle tone",
    "muscle soreness",
    "muscle pain",
    "muscle stiffness",
    "cramping",
    "stiffness",
    "fasciculations",
    "muscle fasciculations",
    "limbs",
    "legs",
    "joints",
    "back",
    "epaxials",
    "gluteals",
  ],
  neurological: [
    "neurological",
    "neuro",
    "cranial nerves",
    "reflexes",
    "ataxia",
    "proprioception",
    "menace",
    "pupillary",
  ],
  eyes: [
    "eyes",
    "eye",
    "ocular",
    "ophthalmic",
    "pupils",
    "sclera",
    "cornea",
    "conjunctiva",
    "vision",
  ],
  skin: [
    "skin",
    "integument",
    "coat",
    "hair",
    "dermatological",
    "lesions",
    "alopecia",
    "pruritus",
  ],
  oral: [
    "oral",
    "oral cavity",
    "teeth",
    "mouth",
    "tongue",
    "pharynx",
  ],
  digital_pulse: [
    "digital pulse",
    "digital pulses",
    "palmar digital pulse",
    "plantar digital pulse",
    "digital arterial pulse",
    "hoof pulse",
    "hoof pulses",
    "foot pulse",
    "feet pulses",
    "bounding pulse",
    "bounding pulses",
    "bounding digital pulse",
    "bounding digital pulses",
    "hooves",
    "hoof",
  ],
};

export default { parseRequestedKeys, matchPhysicalFindings };
