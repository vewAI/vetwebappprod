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
  heart_rate: ["hr", "heart rate", "pulse"],
  respiratory_rate: ["rr", "respiratory rate"],
  temperature: ["temp", "temperature", "t"],
  blood_pressure: ["bp", "blood pressure"],
};

const TOKEN_TO_CANONICAL: Record<string, string> = (() => {
  const out: Record<string, string> = {};
  for (const [canon, aliases] of Object.entries(ALIAS_MAP)) {
    for (const a of aliases) {
      out[a] = canon;
    }
  }
  // also add single-letter shortcuts
  out["hr"] = "heart_rate";
  out["rr"] = "respiratory_rate";
  out["t"] = "temperature";
  out["bp"] = "blood_pressure";
  return out;
})();

function splitTokens(input: string): string[] {
  if (!input) return [];
  // Remove filler words and punctuation then split on comma/and/whitespace
  const cleaned = input
    .toLowerCase()
    .replace(/\b(please|give|values|value|show|what is|what's)\b/g, " ")
    .replace(/[()]/g, " ")
    .replace(/[^a-z0-9,\s/\-]/g, " ")
    .replace(/\band\b/g, ",");

  // Split by comma or whitespace
  const parts = cleaned
    .split(/[ ,]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  return parts;
}

export function parseRequestedKeys(text: string): RequestedKeys {
  const tokens = splitTokens(text || "");
  const canonical: string[] = [];
  for (const tok of tokens) {
    // Trim unit-like suffixes such as mmhg or /min
    const plain = tok.replace(/mmhg$/i, "").replace(/\/.*/g, "");
    if (TOKEN_TO_CANONICAL[plain]) {
      const c = TOKEN_TO_CANONICAL[plain];
      if (!canonical.includes(c)) canonical.push(c);
    } else {
      // try substring match with alias map
      for (const [canon, aliases] of Object.entries(ALIAS_MAP)) {
        if (aliases.some((a) => plain.includes(a.split(" ")[0]))) {
          if (!canonical.includes(canon)) canonical.push(canon);
          break;
        }
      }
    }
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
      // match if any alias appears as a whole word or as a substring
      if (loweredAliases.some((alias) => low.includes(alias.split(" ")[0]))) {
        matched.push(line);
      }
    }

    results.push({ canonicalKey: canon, aliases, lines: matched });
  }

  return results;
}

export default { parseRequestedKeys, matchPhysicalFindings };
