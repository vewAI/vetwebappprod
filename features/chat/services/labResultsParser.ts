import type { LabResultPanel, LabResultRow, LabResultsPayload } from "../models/chat";

const LINE_REGEX = /^[-*]?\s*(.+?):\s*(.+)$/;

const VALUE_UNIT_REGEX =
  /^([*]?\s*[\d.,]+(?:\s*[\-]\s*[\d.,]+)?|[A-Za-z\s*]+?)\s*(x10\^?\d+\/L|g\/[Ld]L|mg\/[Ld]L|mmol\/L|%|fL|umol\/L|mEq\/L|IU\/L|U\/L|bpm|sec)?(.*)$/i;

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
  return {
    name: String(row.name || ""),
    value: row.value === undefined || row.value === null ? "" : String(row.value),
    unit: String(row.unit || ""),
    refRange: row.refRange ? String(row.refRange) : undefined,
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

    const name = matches[1].trim();
    const rawValue = matches[2].trim();

    if (NARRATIVE_ONLY_PATTERNS.some((pattern) => pattern.test(rawValue))) {
      narrativeOnlyCount += 1;
    }

    const valueMatch = rawValue.match(VALUE_UNIT_REGEX);
    if (!valueMatch) {
      currentPanel.rows.push({ name, value: rawValue, unit: "", flag: null });
      continue;
    }

    const valueRaw = valueMatch[1]?.trim() || rawValue;
    const unit = valueMatch[2]?.trim() || "";
    const extra = valueMatch[3]?.trim() || "";

    let flag: "low" | "high" | "critical" | null = null;
    if (/\bleukopenia\b|\blow\b|\bdecreased\b/i.test(extra)) flag = "low";
    if (/\bleukocytosis\b|\bhigh\b|\bincreased\b|\belevated\b/i.test(extra)) flag = "high";
    if (/\bcritical\b|\bmarked\b|\bsevere\b/i.test(extra)) flag = "critical";
    if (valueRaw.startsWith("*")) flag = flag || "high";

    currentPanel.rows.push({
      name,
      value: valueRaw.replace(/^\*\s*/, ""),
      unit,
      flag,
    });
  }

  if (currentPanel.rows.length) panels.push(currentPanel);

  const rowCount = panels.reduce((acc, panel) => acc + panel.rows.length, 0);
  if (rowCount === 0) return null;

  // If all parsed rows are narrative placeholders, do not force table rendering.
  const hasAnyNumericLikeRow = panels.some((panel) => panel.rows.some((row) => /\d/.test(row.value) || Boolean(row.unit)));
  if (!hasAnyNumericLikeRow && narrativeOnlyCount >= rowCount) return null;

  return { panels };
}

function titleCase(text: string): string {
  return text
    .replace(/[_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}
