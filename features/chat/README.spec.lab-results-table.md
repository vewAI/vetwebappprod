# Lab Results Table — Micro-Spec

## User Story

As a practicing veterinary, when the nurse delivers blood-work or lab results in the chat, I want the data rendered as a **formatted results table** (resembling an IDEXX VetLab report) rather than a wall of text, so I can read and interpret the values quickly — just as I would in a real clinical setting.

The nurse agent should detect when its reply contains lab/diagnostic data and emit a **short spoken message** (e.g., _"Here are the results"_) plus a **structured data payload** that the frontend renders as a rich table. The LLM must **never** read every value aloud.

---

## Problem Statement

Currently, when a practicing veterinary requests bloodwork in the Laboratory stage, the API either:
1. Returns a raw text snippet from `diagnostic_findings` (direct DB match), or
2. Passes `diagnostic_findings` to the LLM which paraphrases the data as conversational prose.

Both approaches produce a text blob that is hard to scan. Students are accustomed to tabular lab reports (IDEXX, Zoetis, etc.) with parameter names, values, units, reference ranges, and out-of-range flags.

---

## Data Model

### `LabResultRow` — a single analyte line

```typescript
interface LabResultRow {
  /** Analyte name, e.g. "Neutrophils" */
  name: string;
  /** Numeric or textual value, e.g. "0.82" or "Suspected" */
  value: string;
  /** Unit string, e.g. "x10^9/L", "g/L", "%" */
  unit: string;
  /** Optional reference range, e.g. "2.0–12.0" */
  refRange?: string;
  /** Flag: "low" | "high" | "critical" | null */
  flag?: "low" | "high" | "critical" | null;
}
```

### `LabResultPanel` — a grouped panel (e.g. Haematology, Biochemistry)

```typescript
interface LabResultPanel {
  /** Panel title, e.g. "Haematology", "Biochemistry" */
  title: string;
  /** Optional date/source line, e.g. "13/01/2026 IDEXX VetLab" */
  subtitle?: string;
  /** Ordered rows */
  rows: LabResultRow[];
}
```

### `LabResultsPayload` — top-level structured payload

```typescript
interface LabResultsPayload {
  panels: LabResultPanel[];
}
```

### Extension to existing `Message` model

```typescript
// In features/chat/models/chat.ts — add optional field:
interface Message {
  // ... existing fields ...
  labResults?: LabResultsPayload;
}
```

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│  Student asks: "Can I see the CBC results?"                  │
└──────────────────────────┬───────────────────────────────────┘
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  API Route (app/api/chat/route.ts)                           │
│  1. Detects isLabStage + lab request                         │
│  2. Retrieves diagnostic_findings from DB                    │
│  3. Calls labResultsParser.parse(diagnosticFindings)         │
│     → returns LabResultsPayload (structured)                 │
│  4. If payload has panels:                                   │
│     • content = "Here are the results."                      │
│     • labResults = <structured payload>                      │
│     • (Skip LLM call — factual data, no generation needed)  │
│  5. Returns JSON response with both fields                   │
└──────────────────────────┬───────────────────────────────────┘
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  Chat Service (client)                                       │
│  Receives { content, labResults, displayRole, ... }          │
│  Stores labResults on the Message object                     │
└──────────────────────────┬───────────────────────────────────┘
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  ChatMessage component                                       │
│  • Renders content as spoken text ("Here are the results")   │
│  • If message.labResults exists → renders <LabResultsTable>  │
└──────────────────────────────────────────────────────────────┘
```

---

## Component: `<LabResultsTable>`

### Props

```typescript
interface LabResultsTableProps {
  data: LabResultsPayload;
}
```

### Visual Design (matches IDEXX VetLab style)

```
┌─────────────────────────────────────────────────────┐
│ 🩸 Haematology                                       │
│    13/01/2026 IDEXX VetLab                           │
├──────────────┬──────────┬─────────┬────────┬────────┤
│ Parameter    │ Value    │ Unit    │ Range  │ Status │
├──────────────┼──────────┼─────────┼────────┼────────┤
│ Neutrophils  │ *0.82    │ x10⁹/L │ 2–12   │ ◀ LOW  │
│ Bands        │*Suspected│         │        │        │
│ Lymphocytes  │ *1.32    │ x10⁹/L │ 1.5–7  │  ▐ LOW │
│ Monocytes    │ *0.10    │ x10⁹/L │ 0.15–1 │  ▐ LOW │
│ Eosinophils  │  0.01    │ x10⁹/L │ 0–1.5  │  ▐     │
│ Basophils    │  0.01    │ x10⁹/L │ 0–0.2  │  ▐     │
│ Platelets    │  122     │ x10⁹/L │ 100–   │  ▐     │
│ PDW          │  7.1     │ fL     │        │        │
│ MPV          │  6.2     │ fL     │        │        │
│ Plateletcrit │  0.07    │ %      │        │        │
└──────────────┴──────────┴─────────┴────────┴────────┘
```

### Styling Rules (Tailwind)

- **Table container**: `rounded-xl border border-border bg-card shadow-sm overflow-hidden`
- **Panel header**: Blood-drop icon + title in `text-lg font-bold text-red-600` (haematology) or `text-blue-600` (biochemistry); subtitle in `text-xs text-muted-foreground`
- **Flag coloring**:
  - `flag === "low"` → value cell gets `bg-red-50 text-red-700 font-bold` + asterisk prefix
  - `flag === "high"` → value cell gets `bg-red-50 text-red-700 font-bold` + asterisk prefix
  - `flag === "critical"` → `bg-red-100 text-red-800 font-bold animate-pulse`
  - Normal → default text color
- **Range bar** (optional/stretch): A tiny inline SVG showing a miniature range bar with a marker dot (like the IDEXX screenshot). Purely visual, non-interactive.
- **Responsive**: On mobile (< 640px), hide the Range and Status columns; show flag via colored value text only.

---

## Service: `labResultsParser`

**Location**: `features/chat/services/labResultsParser.ts`

### Responsibility

Parse the free-text `diagnostic_findings` string (from the DB) into a `LabResultsPayload`.

### Input Format (what we parse)

The `diagnostic_findings` field is free-text, typically formatted as:

```
Available diagnostics when requested:
- CBC: mild neutrophilia (14.8 x10^9/L)
- Fibrinogen: 5.5 g/L
- Serum biochemistry: within normal limits
- Nasopharyngeal swab PCR: pending
```

Or for richer cases, it could be structured as a JSON blob stored in the text field:

```json
{
  "haematology": {
    "neutrophils": { "value": 0.82, "unit": "x10^9/L", "refRange": "2.0-12.0", "flag": "low" },
    "lymphocytes": { "value": 1.32, "unit": "x10^9/L", "refRange": "1.5-7.0", "flag": "low" }
  }
}
```

### Parsing Strategy

1. **Try JSON parse first** — if the string is valid JSON matching the structured schema, map directly to `LabResultsPayload`.
2. **Fallback: line-based parsing** — split on `\n`, detect panel headers (e.g., lines containing "CBC", "Haematology", "Biochemistry"), then parse `- Name: value unit` patterns using regex.
3. **Flag detection**: Compare numeric values against known species-specific reference ranges (a small lookup table) or parse inline annotations like `(marked leukopenia)`, `strong positive`.
4. **Return `null`** if the text cannot be meaningfully parsed into rows (e.g., purely narrative text like "within normal limits").

### Exported API

```typescript
export function parseLabResults(
  diagnosticFindings: string,
  species?: string
): LabResultsPayload | null;
```

---

## API Route Changes (`app/api/chat/route.ts`)

### Lab Stage Handling (modify existing `isLabStage` block)

**Before** (current behavior): The route returns raw text snippets or delegates to the LLM.

**After**:

```
IF isLabStage AND diagnostic_findings exists:
  1. parsed = parseLabResults(diagnosticFindings, caseRecord.species)
  2. IF parsed has panels with rows:
     a. content = "Here are the results."
        (Nurse says this — short, professional, no data read aloud)
     b. labResults = parsed
     c. Return JSON { content, labResults, displayRole, portraitUrl, ... }
  3. ELSE (unparseable or narrative-only findings):
     a. Fall through to existing LLM handling
     b. LLM receives diagnostic_findings in system context as before
```

### Response Shape Extension

```typescript
// Existing response fields + new optional field:
{
  content: string;
  displayRole?: string;
  portraitUrl?: string;
  voiceId?: string;
  personaSex?: string;
  personaRoleKey?: string;
  media?: CaseMediaItem[];
  patientSex?: string;
  labResults?: LabResultsPayload;    // NEW
}
```

---

## Client-Side Changes

### 1. `chatService.ts` — pass through `labResults`

In the response handling, read `labResults` from the API response and include it on the `Message` object.

### 2. `chat-message.tsx` — render `<LabResultsTable>`

After the existing `CollapsibleContent` / `MediaRenderer`:

```tsx
{message.labResults && message.labResults.panels.length > 0 ? (
  <LabResultsTable data={message.labResults} />
) : null}
```

### 3. TTS Integration

When a message has `labResults`, the TTS system should only read the `content` text (e.g., "Here are the results") and **not** attempt to vocalize the structured table data. The existing TTS pipeline reads `message.content` so this should work by default — just ensure `labResults` data is never concatenated into `content`.

---

## Critical Rules

1. **Never read lab values aloud**: The nurse's spoken `content` must be a brief phrase. All numeric data lives exclusively in `labResults`.
2. **Factual only**: The parser extracts DB data as-is. No AI generation for the table content — it is deterministic.
3. **Graceful degradation**: If parsing fails, fall back to existing LLM-based text response. The table is an enhancement, not a gate.
4. **No fabrication**: If the DB has no diagnostic_findings, return nothing. Never generate fake lab data.
5. **Existing guardrails preserved**: `findings_release_strategy`, stage restrictions, and persona guardrails remain enforced upstream of the parser.

---

## File Manifest (new / modified)

| File | Action | Description |
|------|--------|-------------|
| `features/chat/models/chat.ts` | **Modify** | Add `labResults?: LabResultsPayload` to `Message` interface; export `LabResultRow`, `LabResultPanel`, `LabResultsPayload` |
| `features/chat/services/labResultsParser.ts` | **Create** | Pure parser: `parseLabResults(text, species?) → LabResultsPayload \| null` |
| `features/chat/components/lab-results-table.tsx` | **Create** | `<LabResultsTable>` React component |
| `features/chat/components/chat-message.tsx` | **Modify** | Import + render `<LabResultsTable>` when `message.labResults` present |
| `features/chat/services/chatService.ts` | **Modify** | Pass `labResults` from API response onto `Message` |
| `app/api/chat/route.ts` | **Modify** | In `isLabStage` block, call parser, attach `labResults` to response |
| `features/chat/__tests__/labResultsParser.test.ts` | **Create** | Unit tests for parser |

---

## Test Plan

### Unit: `labResultsParser.test.ts`

1. **JSON input** → correctly maps to `LabResultsPayload` with flags.
2. **Line-based input** (e.g., Catalina case) → parses panel title, rows with values/units.
3. **Mixed narrative** (e.g., "within normal limits") → returns `null` (not parseable into rows).
4. **Empty / undefined input** → returns `null`.
5. **Malformed JSON** → falls back to line parser.

### Integration: Manual / E2E

1. Open a case in Lab stage, request "show me the CBC".
2. Verify nurse says "Here are the results" (short text).
3. Verify a styled table appears below the message.
4. Verify flagged values (low/high) are highlighted in red.
5. Verify TTS reads only "Here are the results", not the table data.

---

## Implementation Sequence (5 commits)

1. **Models** — Add interfaces to `chat.ts`
2. **Parser** — Create `labResultsParser.ts` + unit tests
3. **Component** — Create `<LabResultsTable>` component
4. **API wiring** — Modify `route.ts` to call parser and return `labResults`
5. **Client wiring** — Modify `chatService.ts` + `chat-message.tsx` to render

---

## Enriching `diagnostic_findings` for Table Rendering

To get the best table output, **case authors should store structured JSON** in the `diagnostic_findings` field when possible. The parser supports both formats, but JSON produces richer tables with reference ranges and flags.

### Recommended JSON schema for case data:

```json
{
  "panels": [
    {
      "title": "Haematology",
      "subtitle": "13/01/2026 IDEXX VetLab",
      "rows": [
        { "name": "Neutrophils", "value": "0.82", "unit": "x10^9/L", "refRange": "2.0–12.0", "flag": "low" },
        { "name": "Bands", "value": "*Suspected", "unit": "", "refRange": "", "flag": null },
        { "name": "Lymphocytes", "value": "1.32", "unit": "x10^9/L", "refRange": "1.5–7.0", "flag": "low" },
        { "name": "Monocytes", "value": "0.10", "unit": "x10^9/L", "refRange": "0.15–1.3", "flag": "low" },
        { "name": "Eosinophils", "value": "0.01", "unit": "x10^9/L", "refRange": "0–1.5", "flag": null },
        { "name": "Basophils", "value": "0.01", "unit": "x10^9/L", "refRange": "0–0.2", "flag": null },
        { "name": "Platelets", "value": "122", "unit": "x10^9/L", "refRange": "100–500", "flag": null },
        { "name": "PDW", "value": "7.1", "unit": "fL", "flag": null },
        { "name": "MPV", "value": "6.2", "unit": "fL", "flag": null },
        { "name": "Plateletcrit", "value": "0.07", "unit": "%", "flag": null }
      ]
    }
  ]
}
```

---

*File: features/chat/README.spec.lab-results-table.md*
