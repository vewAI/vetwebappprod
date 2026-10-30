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
- `CaseLibrary`
  - Title, discipline/species `Select` filters, sortable table
  - `getCaseHref(case)` sets the row destination (`/cases/{id}` on `/cases`, `/case-viewer?id=` on `/case-viewer`)
  - `showPublished` adds a Published column with a tick or a cross. `includeUnpublished` lists unpublished cases. Both are used on `/case-viewer`.
- `CaseDashboard` — professor/admin `/cases/{id}`: summary card plus Case Overview, Sessions, and Attempts tabs.
- `TimeProgressionEditor`
  - Template selector (`select`) for stage templates
  - `Add Stage` button
  - Existing timeline list of editable `CaseTimepoint` cards

## Case Viewer
Admins pick a case at `/case-viewer` from the same table as `/cases`, then review or edit it at `/case-viewer?id={caseId}`.
The case viewer and Stage Manager provide a **Test case** action. Stage Manager asks authors to save pending stage changes first. Testing opens the live case in a new tab as a fresh administrator attempt with no class session attached, including for draft cases. It does not use a student's session attempt allowance.
The admin-only list shows separate sortable **Author**, **Institution**, and **Date created** columns. A search field filters cases by institution name (case-insensitive partial match) alongside discipline and species filters. New cases still record the authenticated creator's user ID in `cases.settings.createdByUserId` for provenance, but the list displays the clinical author rather than a duplicate Created by column. The date comes from `cases.created_at` and is displayed in Europe/London time. Editing a case must preserve its original creator and creation date.
Clinical Author and Institution appear together in case information and can be edited there. New cases store them in `cases.settings.authorName` and `institutionName`; intake extracts only explicit credits from the source. Older cases display explicit attribution found in their saved case history, including the template's “Author name and institution” entry. Missing credit remains Unknown until an editor supplies it.

### API Contract
#### GET /api/cases?id={caseId}
- Admin only.
- Output: a one-item array of the matching case, including archived cases.
- 404 when the id is missing from the database.

### Critical Rules
- Non-admins cannot view `/case-viewer`.
- `/case-viewer` with no `id` uses the `/cases` table plus a Published column (tick or cross), and includes unpublished cases. Row links go to `/case-viewer?id={caseId}`.
- With `?id=`, breadcrumb is Home > Admin > Review and Edit Cases > case id. The page title is the case title and the subtitle is the case id. The listing title is Review and Edit Cases. Admins publish or unpublish with buttons next to Edit/Archive. A warning alert modal confirms the change.
- `/cases` has no edit-case link. Rows open case instructions.

## Timepoint Critical Rules
- Must support unlimited stage/timepoint creation.
- Template selection only pre-fills values; author can edit any field afterwards.
- Keep current API routes; no backend migration required for MVP.
- Default persona for templates must match follow-up context (`owner` vs `veterinary-nurse`).
- Preserve existing read-only behavior.
