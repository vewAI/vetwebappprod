import type { LabResultPanel, LabResultRow, LabResultsPayload } from "../models/chat";

const LINE_REGEX = /^[-*]?\s*(.+?):\s*(.+)$/;

const VALUE_UNIT_REGEX =
  /^([*]?\s*[-+]?\d[\d.,]*(?:\s*[\-/]\s*[-+]?\d[\d.,]*)?)\s*(x10\^?\d+\/?[Ll]?|g\/[Ll]|g\/[Dd][Ll]|mg\/[Ll]|mg\/[Dd][Ll]|mmol\/[Ll]|umol\/[Ll]|mEq\/[Ll]|IU\/[Ll]|U\/[Ll]|ng\/[mM][Ll]|pg\/[mM][Ll]|bpm|mmhg|sec|s|%|fL)?(.*)$/i;

const PANEL_KEYWORDS: Record<string, string> = {
  cbc: "Haematology (CBC)",
  haematology: "Haematology",
  hematology: "Haematology",
  biochemistry: "Biochemistry",
  chemistry: "Biochemistry",
  electrolytes: "Electrolytes",
  urinalysis: "Urinalysis",
  serology: "Serology",
  coagulation: "Coagulation",
};

const NARRATIVE_ONLY_PATTERNS = [/\bwithin\s+normal\s+limits\b/i, /\bpending\b/i, /\bno\s+abnormalit(y|ies)\b/i];

function stripWrappingQuotes(text: string): string {
  let out = text.trim();
  out = out.replace(/^"+|"+$/g, "").trim();
  out = out.replace(/^'+|'+$/g, "").trim();
  return out;
}

function cleanFieldText(text: string): string {
  let out = stripWrappingQuotes(String(text || ""));
  out = out.replace(/[\u201c\u201d]/g, "");
  out = out.replace(/\s+,\s*$/g, "");
  out = out.replace(/\s{2,}/g, " ");
  return out.trim();
}

function isObjectMarkerValue(value: string): boolean {
  const v = value.trim();
  return v === "{" || v === "}" || v === "[" || v === "]";
}

function parseValueParts(rawValue: string): { value: string; unit: string; extra: string } {
  const cleaned = cleanFieldText(rawValue);
  const numericMatch = cleaned.match(VALUE_UNIT_REGEX);
  if (!numericMatch) {
    return { value: cleaned, unit: "", extra: "" };
  }

  const value = cleanFieldText(numericMatch[1] || cleaned).replace(/^\*\s*/, "");
  const unit = cleanFieldText(numericMatch[2] || "");
  const extra = cleanFieldText(numericMatch[3] || "");

  // If regex produced a suspiciously short token for a clearly narrative string,
  // keep the original full value instead of truncating.
  if (!unit && !extra && value.length <= 2 && /[A-Za-z]{3,}/.test(cleaned)) {
    return { value: cleaned, unit: "", extra: "" };
  }

  return { value, unit, extra };
}

/**
 * Parses diagnostic findings into a structured table payload.
 * JSON payloads are preferred; line-based legacy text is supported as fallback.
 */
export function parseLabResults(diagnosticFindings: string, _species?: string): LabResultsPayload | null {
  if (!diagnosticFindings || !diagnosticFindings.trim()) return null;

  const text = diagnosticFindings.trim();

  const fromJson = tryParseJson(text);
  if (fromJson) return fromJson;

  return tryParseLines(text);
}

function tryParseJson(text: string): LabResultsPayload | null {
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!parsed || typeof parsed !== "object") return null;

    const root = parsed as Record<string, unknown>;

    if (Array.isArray(root.panels)) {
      const panels = root.panels
        .filter((panel) => panel && typeof panel === "object")
        .map((panel) => normalizePanel(panel as Record<string, unknown>))
        .filter((panel): panel is LabResultPanel => Boolean(panel && panel.rows.length > 0));
      return panels.length ? { panels } : null;
    }

    const nestedPanels: LabResultPanel[] = [];
    for (const [panelKey, panelValue] of Object.entries(root)) {
      if (!panelValue || typeof panelValue !== "object" || Array.isArray(panelValue)) continue;
      const panelObj = panelValue as Record<string, unknown>;
      const rows: LabResultRow[] = [];
      for (const [rowKey, rowValue] of Object.entries(panelObj)) {
        if (!rowValue || typeof rowValue !== "object" || Array.isArray(rowValue)) continue;
        rows.push(normalizeRow({ name: titleCase(rowKey), ...(rowValue as Record<string, unknown>) }));
      }
      if (rows.length) nestedPanels.push({ title: titleCase(panelKey), rows });
    }

    return nestedPanels.length ? { panels: nestedPanels } : null;
  } catch {
    return null;
  }
}

function normalizePanel(panel: Record<string, unknown>): LabResultPanel | null {
  if (!Array.isArray(panel.rows)) return null;
  const rows = panel.rows
    .filter((row) => row && typeof row === "object")
    .map((row) => normalizeRow(row as Record<string, unknown>))
    .filter((row): row is LabResultRow => Boolean(row.name));

  if (!rows.length) return null;

  return {
    title: String(panel.title || "Results"),
    subtitle: panel.subtitle ? String(panel.subtitle) : undefined,
    rows,
  };
}

function normalizeRow(row: Record<string, unknown>): LabResultRow {
  const name = cleanFieldText(String(row.name || ""));
  const value =
    row.value === undefined || row.value === null
      ? ""
      : cleanFieldText(String(row.value));

  return {
    name,
    value,
    unit: cleanFieldText(String(row.unit || "")),
    refRange: row.refRange ? cleanFieldText(String(row.refRange)) : undefined,
    flag: normalizeFlag(row.flag),
  };
}

function normalizeFlag(flag: unknown): "low" | "high" | "critical" | null {
  if (typeof flag !== "string") return null;
  const lower = flag.toLowerCase();
  if (lower === "low" || lower === "high" || lower === "critical") return lower;
  return null;
}

function tryParseLines(text: string): LabResultsPayload | null {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return null;

  let narrativeOnlyCount = 0;
  const panels: LabResultPanel[] = [];
  let currentPanel: LabResultPanel = { title: "Results", rows: [] };

  for (const line of lines) {
    if (/^available\b/i.test(line)) continue;

    const lowerNormalized = line
      .toLowerCase()
      .replace(/[^a-z\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const foundPanelKeyword = Object.entries(PANEL_KEYWORDS).find(([keyword]) => lowerNormalized.includes(keyword));

    if (foundPanelKeyword && !LINE_REGEX.test(line)) {
      if (currentPanel.rows.length) panels.push(currentPanel);
      currentPanel = { title: foundPanelKeyword[1], rows: [] };
      continue;
    }

    const matches = line.match(LINE_REGEX);
    if (!matches) {
      narrativeOnlyCount += NARRATIVE_ONLY_PATTERNS.some((pattern) => pattern.test(line)) ? 1 : 0;
      continue;
    }

    const name = cleanFieldText(matches[1].trim());
    const rawValue = cleanFieldText(matches[2].trim());

    if (!name || isObjectMarkerValue(rawValue)) {
      continue;
    }

    if (NARRATIVE_ONLY_PATTERNS.some((pattern) => pattern.test(rawValue))) {
      narrativeOnlyCount += 1;
    }

    const { value: valueRaw, unit, extra } = parseValueParts(rawValue);

    let flag: "low" | "high" | "critical" | null = null;
    if (/\bleukopenia\b|\blow\b|\bdecreased\b/i.test(extra)) flag = "low";
    if (/\bleukocytosis\b|\bhigh\b|\bincreased\b|\belevated\b/i.test(extra)) flag = "high";
    if (/\bcritical\b|\bmarked\b|\bsevere\b/i.test(extra)) flag = "critical";
    if (/^\*/.test(rawValue)) flag = flag || "high";

    currentPanel.rows.push({
      name,
      value: cleanFieldText(valueRaw.replace(/^\*\s*/, "")),
      unit,
      flag,
    });
  }

  if (currentPanel.rows.length) panels.push(currentPanel);

  const cleanedPanels = panels
    .map((panel) => ({
      ...panel,
      rows: panel.rows.filter((row) => row.name && row.value && !isObjectMarkerValue(row.value)),
    }))
    .filter((panel) => panel.rows.length > 0);

  const rowCount = cleanedPanels.reduce((acc, panel) => acc + panel.rows.length, 0);
  if (rowCount === 0) return null;

  // If all parsed rows are narrative placeholders, do not force table rendering.
  const hasAnyNumericLikeRow = cleanedPanels.some((panel) => panel.rows.some((row) => /\d/.test(row.value) || Boolean(row.unit)));
  if (!hasAnyNumericLikeRow && narrativeOnlyCount >= rowCount) return null;

  return { panels: cleanedPanels };
}

function titleCase(text: string): string {
  return text
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}
