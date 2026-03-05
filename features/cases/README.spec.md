# Cases Feature Spec

## User Story
As a case author, I want to add an unlimited number of longitudinal follow-up stages (timepoints) using reusable templates, so I can model multi-day progression and repeated checks (history, exam, diagnostics, treatment response).

## Data Model
```ts
interface CaseTimepoint {
  id: string;
  case_id: string;
  sequence_index: number;
  label: string;
  summary?: string | null;
  available_after_hours?: number | null;
  after_stage_id?: string | null;
  persona_role_key?: string | null;
  stage_prompt?: string | null;
  created_at?: string;
  updated_at?: string;
}

interface TimepointTemplate {
  key:
    | "custom-blank"
    | "recheck-history"
    | "recheck-exam"
    | "repeat-diagnostics"
    | "treatment-response"
    | "owner-followup";
  label: string;
  defaultLabelPrefix: string;
  summary: string;
  stage_prompt: string;
  persona_role_key: "owner" | "veterinary-nurse";
  available_after_hours: number;
}
```

## API Contract
### GET /api/cases/:caseId/timepoints
- Output: `CaseTimepoint[]` ordered by `sequence_index`

### POST /api/cases/:caseId/timepoints
- Input: `CreateCaseTimepointDTO`
- Output: created `CaseTimepoint`
- Rule: `sequence_index` must be computed by client as `max(existing.sequence_index) + 1` to support indefinite additions even after deletions.

### PATCH /api/cases/:caseId/timepoints/:timepointId
- Input: `Partial<CreateCaseTimepointDTO>`
- Output: updated `CaseTimepoint`

## Component Tree
- `TimeProgressionEditor`
  - Template selector (`select`) for stage templates
  - `Add Stage` button
  - Existing timeline list of editable `CaseTimepoint` cards

## Critical Rules
- Must support unlimited stage/timepoint creation.
- Template selection only pre-fills values; author can edit any field afterwards.
- Keep current API routes; no backend migration required for MVP.
- Default persona for templates must match follow-up context (`owner` vs `veterinary-nurse`).
- Preserve existing read-only behavior.
