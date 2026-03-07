# Implementation Prompt: Lab Results Table Feature

> **Purpose**: This document is a self-contained implementation prompt designed to be given
> to a smaller LLM (e.g., GPT-4o-mini, Claude Haiku/Sonnet) to implement the Lab Results
> Table feature step-by-step. Each step includes exact file paths, snippets to modify, and
> the code to write. The implementing agent should execute steps 1–5 in order.

---

## Context for the implementing agent

You are working in a Next.js 13+ App Router project (TypeScript, Tailwind CSS).
The chat system has:
- **Message model** at `features/chat/models/chat.ts`
- **Chat message renderer** at `features/chat/components/chat-message.tsx`
- **Chat service** at `features/chat/services/chatService.ts`
- **API route** at `app/api/chat/route.ts`

The goal: When the nurse persona returns lab/blood results, instead of reading all values
as text, the system should:
1. Parse the raw `diagnostic_findings` text into structured data
2. Return a short spoken message + a structured `labResults` payload
3. Render the payload as a beautiful clinical-style table in the chat

---

## STEP 1: Add type definitions to the Message model

**File**: `features/chat/models/chat.ts`

Add these interfaces BEFORE the existing `Message` interface, then add `labResults?` to `Message`:

```typescript
// --- Lab Results Table types ---

export interface LabResultRow {
  name: string;
  value: string;
  unit: string;
  refRange?: string;
  flag?: "low" | "high" | "critical" | null;
}

export interface LabResultPanel {
  title: string;
  subtitle?: string;
  rows: LabResultRow[];
}

export interface LabResultsPayload {
  panels: LabResultPanel[];
}
```

Then add to the `Message` interface (after `structuredFindings`):

```typescript
  labResults?: LabResultsPayload;
```

---

## STEP 2: Create the parser service

**File**: `features/chat/services/labResultsParser.ts` (NEW FILE)

This is a **pure function** with zero external dependencies. It takes the raw
`diagnostic_findings` string and returns `LabResultsPayload | null`.

```typescript
import type { LabResultRow, LabResultPanel, LabResultsPayload } from "../models/chat";

/**
 * Attempt to parse diagnostic_findings text into structured lab result panels.
 * Tries JSON first, then falls back to line-based parsing.
 * Returns null if the text cannot be meaningfully parsed into table rows.
 */
export function parseLabResults(
  diagnosticFindings: string,
  species?: string
): LabResultsPayload | null {
  if (!diagnosticFindings || !diagnosticFindings.trim()) return null;

  const text = diagnosticFindings.trim();

  // Strategy 1: Try JSON parse
  const jsonResult = tryParseJson(text);
  if (jsonResult) return jsonResult;

  // Strategy 2: Line-based parsing
  return tryParseLines(text, species);
}

// ── JSON strategy ────────────────────────────────────────────

function tryParseJson(text: string): LabResultsPayload | null {
  try {
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== "object") return null;

    // Format A: { panels: [...] } — already matches our schema
    if (Array.isArray(parsed.panels)) {
      const panels = parsed.panels
        .filter((p: any) => p && typeof p === "object" && Array.isArray(p.rows))
        .map((p: any) => ({
          title: String(p.title || "Results"),
          subtitle: p.subtitle ? String(p.subtitle) : undefined,
          rows: (p.rows as any[]).map(mapJsonRow),
        }))
        .filter((p: LabResultPanel) => p.rows.length > 0);
      return panels.length > 0 ? { panels } : null;
    }

    // Format B: { "haematology": { "neutrophils": {...}, ... }, "biochemistry": {...} }
    const panels: LabResultPanel[] = [];
    for (const [panelKey, panelVal] of Object.entries(parsed)) {
      if (!panelVal || typeof panelVal !== "object" || Array.isArray(panelVal)) continue;
      const rows: LabResultRow[] = [];
      for (const [rowKey, rowVal] of Object.entries(panelVal as Record<string, unknown>)) {
        if (rowVal && typeof rowVal === "object" && !Array.isArray(rowVal)) {
          rows.push(mapJsonRow({ name: formatName(rowKey), ...(rowVal as Record<string, unknown>) }));
        }
      }
      if (rows.length > 0) {
        panels.push({ title: formatName(panelKey), rows });
      }
    }
    return panels.length > 0 ? { panels } : null;
  } catch {
    return null;
  }
}

function mapJsonRow(r: any): LabResultRow {
  return {
    name: String(r.name || ""),
    value: String(r.value ?? ""),
    unit: String(r.unit || ""),
    refRange: r.refRange ? String(r.refRange) : undefined,
    flag: normalizeFlag(r.flag),
  };
}

function normalizeFlag(f: unknown): "low" | "high" | "critical" | null {
  if (typeof f !== "string") return null;
  const fl = f.toLowerCase();
  if (fl === "low") return "low";
  if (fl === "high") return "high";
  if (fl === "critical") return "critical";
  return null;
}

function formatName(key: string): string {
  return key
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Line-based strategy ──────────────────────────────────────

const LINE_REGEX = /^[-•*]?\s*(.+?):\s*(.+)$/;
const VALUE_UNIT_REGEX = /^([*]?\s*[\d.,]+(?:\s*[–\-]\s*[\d.,]+)?|[A-Za-z\s*]+?)\s*(x10\^?\d+\/L|g\/[Ld]L|mg\/[Ld]L|mmol\/L|%|fL|μmol\/L|mEq\/L|IU\/L|U\/L|bpm|°[CF]|sec)?(.*)$/i;

// Known panel header keywords
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

function tryParseLines(text: string, _species?: string): LabResultsPayload | null {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return null;

  const panels: LabResultPanel[] = [];
  let currentPanel: LabResultPanel = { title: "Results", rows: [] };

  for (const line of lines) {
    // Skip preamble lines like "Available diagnostics when requested:"
    if (/available|when requested|laboratory data/i.test(line) && !line.includes(":")) continue;
    if (/^available\b/i.test(line)) continue;

    // Check if this line is a panel header
    const lowerLine = line.toLowerCase().replace(/[^a-z\s]/g, "").trim();
    const matchedPanel = Object.entries(PANEL_KEYWORDS).find(([kw]) => lowerLine.includes(kw));
    if (matchedPanel && !LINE_REGEX.test(line)) {
      // Start a new panel
      if (currentPanel.rows.length > 0) panels.push(currentPanel);
      currentPanel = { title: matchedPanel[1], rows: [] };
      continue;
    }

    // Try to parse as a data line: "- Name: value unit"
    const lineMatch = line.match(LINE_REGEX);
    if (lineMatch) {
      const paramName = lineMatch[1].trim();
      const rawValue = lineMatch[2].trim();

      // Try to extract value and unit from rawValue
      const vuMatch = rawValue.match(VALUE_UNIT_REGEX);
      if (vuMatch) {
        const value = vuMatch[1]?.trim() || rawValue;
        const unit = vuMatch[2]?.trim() || "";
        const extra = vuMatch[3]?.trim() || "";

        // Detect flag from extra text
        let flag: "low" | "high" | "critical" | null = null;
        if (/leukopenia|low|decreased|↓/i.test(extra)) flag = "low";
        else if (/leukocytosis|high|increased|elevated|↑/i.test(extra)) flag = "high";
        else if (/critical|marked|severe/i.test(extra)) flag = "critical";
        // Also flag values with asterisk prefix
        if (value.startsWith("*")) flag = flag || "high";

        currentPanel.rows.push({
          name: paramName,
          value: value.replace(/^\*\s*/, ""),
          unit,
          flag,
        });
      } else {
        // Can't parse value/unit — store as-is
        currentPanel.rows.push({
          name: paramName,
          value: rawValue,
          unit: "",
          flag: null,
        });
      }
    }
  }

  // Push last panel
  if (currentPanel.rows.length > 0) panels.push(currentPanel);

  return panels.length > 0 ? { panels } : null;
}
```

---

## STEP 3: Create the `<LabResultsTable>` component

**File**: `features/chat/components/lab-results-table.tsx` (NEW FILE)

```tsx
import { cn } from "@/lib/utils";
import type { LabResultsPayload, LabResultPanel, LabResultRow } from "../models/chat";

interface LabResultsTableProps {
  data: LabResultsPayload;
}

const PANEL_ICONS: Record<string, string> = {
  haematology: "🩸",
  hematology: "🩸",
  cbc: "🩸",
  biochemistry: "🧪",
  chemistry: "🧪",
  electrolytes: "⚡",
  urinalysis: "🧫",
  coagulation: "🩹",
};

function getPanelIcon(title: string): string {
  const lower = title.toLowerCase();
  for (const [key, icon] of Object.entries(PANEL_ICONS)) {
    if (lower.includes(key)) return icon;
  }
  return "📋";
}

function FlagBadge({ flag }: { flag: LabResultRow["flag"] }) {
  if (!flag) return null;
  const label = flag === "low" ? "LOW" : flag === "high" ? "HIGH" : "CRIT";
  return (
    <span
      className={cn(
        "ml-1 inline-flex items-center rounded px-1 py-0.5 text-[0.6rem] font-bold uppercase leading-none",
        flag === "critical"
          ? "bg-red-200 text-red-900 dark:bg-red-900 dark:text-red-200"
          : "bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300"
      )}
    >
      {flag === "low" ? "▼" : "▲"} {label}
    </span>
  );
}

function PanelTable({ panel }: { panel: LabResultPanel }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      {/* Header */}
      <div className="border-b border-border bg-muted/30 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-lg" role="img" aria-label={panel.title}>
            {getPanelIcon(panel.title)}
          </span>
          <h3 className="text-base font-bold text-red-600 dark:text-red-400">
            {panel.title}
          </h3>
        </div>
        {panel.subtitle && (
          <p className="mt-0.5 text-xs text-muted-foreground">{panel.subtitle}</p>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/20 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-2">Parameter</th>
              <th className="px-4 py-2">Value</th>
              <th className="px-4 py-2">Unit</th>
              <th className="hidden px-4 py-2 sm:table-cell">Ref. Range</th>
              <th className="px-4 py-2 w-20">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {panel.rows.map((row, i) => (
              <tr
                key={`${row.name}-${i}`}
                className={cn(
                  "transition-colors hover:bg-muted/30",
                  row.flag === "critical" && "bg-red-50 dark:bg-red-950/30"
                )}
              >
                <td className="px-4 py-2.5 font-medium">{row.name}</td>
                <td
                  className={cn(
                    "px-4 py-2.5 tabular-nums",
                    row.flag && "font-bold text-red-700 dark:text-red-400"
                  )}
                >
                  {row.flag && <span className="mr-0.5">*</span>}
                  {row.value}
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">{row.unit}</td>
                <td className="hidden px-4 py-2.5 text-muted-foreground sm:table-cell">
                  {row.refRange || "—"}
                </td>
                <td className="px-4 py-2.5">
                  <FlagBadge flag={row.flag} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function LabResultsTable({ data }: LabResultsTableProps) {
  if (!data.panels || data.panels.length === 0) return null;

  return (
    <div className="mt-3 space-y-4">
      {data.panels.map((panel, i) => (
        <PanelTable key={`${panel.title}-${i}`} panel={panel} />
      ))}
    </div>
  );
}
```

---

## STEP 4: Wire the API route

**File**: `app/api/chat/route.ts`

At the **top** of the file, add the import (near the other feature imports):

```typescript
import { parseLabResults } from "@/features/chat/services/labResultsParser";
```

Then, find the block that starts with `if (isLabStage && caseRecord && typeof caseRecord === "object")`.
Inside that block, BEFORE the existing matchedDiagKey logic, add an early return for full
lab results when the student asks for all results or a general lab request:

Find this section (approximately):
```typescript
if (isLabStage && caseRecord && typeof caseRecord === "object") {
  const diag = (caseRecord as Record<string, unknown>)["diagnostic_findings"];
  if (typeof diag === "string" && diag.trim().length > 0) {
```

Add after the `diagText` assignment, BEFORE the `matchedDiagKey` logic:

```typescript
    // ── Lab Results Table: structured rendering ─────────────
    // When the student asks for results generically (or specifically for
    // a panel that maps to the full findings), attempt to parse the
    // diagnostic_findings into a structured table payload.
    const caseSpecies = caseRecord && typeof caseRecord === "object"
      ? String((caseRecord as any).species ?? "")
      : undefined;
    const labResultsPayload = parseLabResults(diagText, caseSpecies);

    // Detect if this is a general "show me results" / "what are the lab results" request
    // rather than a narrowly targeted single-test query (which the existing matchedDiagKey
    // logic already handles well).
    const isGeneralLabRequest = /\b(results|bloodwork|bloods|blood\s*work|labs|all|full|complete|show|cbc|haem|hem)\b/i.test(userText);

    if (labResultsPayload && labResultsPayload.panels.length > 0 && isGeneralLabRequest) {
      return NextResponse.json({
        content: "Here are the results.",
        displayRole,
        portraitUrl: personaImageUrl,
        voiceId: personaVoiceId,
        personaSex,
        personaRoleKey,
        media: [],
        patientSex,
        labResults: labResultsPayload,
      });
    }
    // ── End Lab Results Table ────────────────────────────────
```

---

## STEP 5: Wire the client side

### 5a. Chat service (`features/chat/services/chatService.ts`)

Find where the response is returned from `sendMessage`. The response object maps API fields
to the return value. Add `labResults`:

Find the `return` statement that builds the response object and add:

```typescript
labResults: data.labResults,
```

### 5b. Chat message renderer (`features/chat/components/chat-message.tsx`)

Add the import at the top of the file:

```typescript
import { LabResultsTable } from "./lab-results-table";
```

Then, in the `ChatMessage` component, find where `MediaRenderer` is rendered:

```tsx
{Array.isArray(message.media) && message.media.length > 0 ? (
  <MediaRenderer items={message.media} />
) : null}
```

Add immediately AFTER it:

```tsx
{message.labResults && message.labResults.panels.length > 0 ? (
  <LabResultsTable data={message.labResults} />
) : null}
```

### 5c. Chat interface (`features/chat/components/chat-interface.tsx`)

Find where the assistant message is constructed from the API response (search for where
`response.content` is used to build the Message object). Ensure `labResults` is spread
onto the message:

```typescript
labResults: (response as any)?.labResults,
```

---

## STEP 6: Unit tests

**File**: `features/chat/__tests__/labResultsParser.test.ts` (NEW FILE)

```typescript
import { describe, it, expect } from "vitest";
import { parseLabResults } from "../services/labResultsParser";

describe("parseLabResults", () => {
  it("returns null for empty input", () => {
    expect(parseLabResults("")).toBeNull();
    expect(parseLabResults("   ")).toBeNull();
  });

  it("parses JSON panels format", () => {
    const input = JSON.stringify({
      panels: [
        {
          title: "Haematology",
          subtitle: "13/01/2026",
          rows: [
            { name: "Neutrophils", value: "0.82", unit: "x10^9/L", refRange: "2.0-12.0", flag: "low" },
            { name: "Platelets", value: "122", unit: "x10^9/L", flag: null },
          ],
        },
      ],
    });
    const result = parseLabResults(input);
    expect(result).not.toBeNull();
    expect(result!.panels).toHaveLength(1);
    expect(result!.panels[0].title).toBe("Haematology");
    expect(result!.panels[0].rows).toHaveLength(2);
    expect(result!.panels[0].rows[0].flag).toBe("low");
  });

  it("parses JSON nested object format", () => {
    const input = JSON.stringify({
      haematology: {
        neutrophils: { value: "0.82", unit: "x10^9/L", flag: "low" },
        lymphocytes: { value: "1.32", unit: "x10^9/L", flag: "low" },
      },
    });
    const result = parseLabResults(input);
    expect(result).not.toBeNull();
    expect(result!.panels).toHaveLength(1);
    expect(result!.panels[0].title).toBe("Haematology");
    expect(result!.panels[0].rows).toHaveLength(2);
  });

  it("parses line-based diagnostic_findings", () => {
    const input = `Available diagnostics when requested:
- CBC: mild neutrophilia (14.8 x10^9/L)
- Fibrinogen: 5.5 g/L
- Serum biochemistry: within normal limits`;
    const result = parseLabResults(input);
    expect(result).not.toBeNull();
    expect(result!.panels.length).toBeGreaterThanOrEqual(1);
    const allRows = result!.panels.flatMap((p) => p.rows);
    expect(allRows.length).toBeGreaterThanOrEqual(2);
  });

  it("returns null for purely narrative text", () => {
    const input = "The animal appeared healthy with no abnormalities noted.";
    expect(parseLabResults(input)).toBeNull();
  });
});
```

---

## Verification Checklist

After implementing all steps, verify:

- [ ] `npm run lint` passes with no new errors
- [ ] `npm run test` passes (including the new test file)
- [ ] Opening a case in the Lab stage and requesting CBC/bloodwork shows a table
- [ ] The nurse message text is short (e.g., "Here are the results.")
- [ ] Flagged values appear in red with LOW/HIGH badges
- [ ] The table is responsive (hides ref range column on mobile)
- [ ] TTS only reads the short text, not the table values
- [ ] If diagnostic_findings cannot be parsed, the old text-based behavior still works
