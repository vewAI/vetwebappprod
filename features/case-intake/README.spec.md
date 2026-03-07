# Case Intake Spec

## User Story
Professors and admins can create cases from a full pasted narrative or uploaded source document (PDF/TXT), then complete missing fields through an AI-guided, step-by-step wizard before saving and optionally continuing to edit stages.

## Data Model
```ts
interface CaseIntakeInput {
  rawText: string;
  sourceFileName?: string | null;
  sourceFileType?: "application/pdf" | "text/plain" | string | null;
  sourceFileUrl?: string | null;
}

interface CaseFieldCompletionItem {
  fieldKey: string;
  label: string;
  extractedValue: string;
  isMissing: boolean;
  missingReason: string;
  aiSuggestion: string;
  confidence?: number;
}

interface CaseIntakeAnalysisResult {
  draftCase: Record<string, string>;
  completionPlan: CaseFieldCompletionItem[];
  missingCount: number;
  sourceSummary: string;
}

interface CaseIntakeWizardState {
  analysis: CaseIntakeAnalysisResult;
  currentIndex: number;
  approvedValues: Record<string, string>;
  completedFieldKeys: string[];
}

interface CaseIntakeSaveResult {
  caseId: string;
  title: string;
  savedAt: string;
}
```

## API Contract
### POST /api/case-intake/analyze
- Auth: `admin` or `professor` only
- Input: `CaseIntakeInput`
- Behavior:
  - Parse uploaded source (PDF/TXT) when provided.
  - Combine source text + pasted text.
  - Send to LLM with strict extraction instructions and one complete canonical example (`case-1`) for target field format.
  - Return structured per-field extraction + missing analysis.
- Output: `CaseIntakeAnalysisResult`

### POST /api/case-intake/save
- Auth: `admin` or `professor` only
- Input: `{ approvedValues: Record<string, string> }`
- Behavior: Persist case record using existing `cases` create pathway.
- Output: `CaseIntakeSaveResult`

### POST /api/case-intake/export
- Auth: `admin` or `professor` only
- Input: `{ caseId: string, format: "txt" }`
- Output: downloadable payload metadata `{ fileName, mimeType, contentBase64 }`

## Component Tree
- `CaseIntakeEntry` (new main container in `app/case-entry/page.tsx`)
  - `CaseSourceComposer`
    - `rawText` textarea (large, multiline)
    - source upload button (`.pdf`, `.txt`, `.docx`)
    - analyze trigger button
  - `CaseIntakeWizard`
    - `FieldReviewStep` (one field at a time)
      - field label
      - why missing (from LLM)
      - AI suggestion block
      - editable textarea/input
      - actions: approve, skip, back, next
    - progress indicator
  - `CaseIntakeSummary`
    - save button
    - after save actions: download, open in case viewer edit, open stage editor

## Critical Rules
- Access control must enforce creator role as `admin` or `professor` in both UI and API.
- Student users must not see creation entry points.
- Route is shared: both roles use `/case-entry`.
- LLM output must be machine-parseable JSON with fixed keys matching case fields.
- Missing-field prompts must always include:
  - explicit missing reason from source
  - personalized suggestion aligned with current case context
- Wizard is strictly sequential by default, but allows back/next and explicit skip.
- Saving is only allowed after all fields have been reviewed (approved or skipped).
- Post-save UX must provide direct actions:
  - download case data
  - edit saved case
  - edit case stages

## Implementation Plan (Phase 1)
1. Add role-gated create entry buttons for admin and professor dashboards.
2. Replace current `case-entry` form top area with source composer + analyze flow.
3. Build server analyze endpoint with parser + LLM structured output.
4. Build field-by-field wizard UI with missing reason + AI suggestion.
5. Save approved values using existing cases API.
6. Add post-save action panel (download/edit/edit stages).

## Non-Goals (Phase 1)
- Automatic stage generation from source text.
- Multi-document semantic merge ranking.
- Background async ingestion jobs.
