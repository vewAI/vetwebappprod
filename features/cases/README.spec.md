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
The admin-only list adds sortable **Created by** and **Date created** columns. New cases record the authenticated creator's user ID in `cases.settings.createdByUserId`; an admin-only lookup resolves the name from `profiles.full_name` or email. Existing cases without trustworthy creator metadata show **Unknown**. The date comes from `cases.created_at` and is displayed in Europe/London time. Editing a case must preserve its original creator and creation date.
Clinical **Author / Institution** is separate from the account that uploaded a case. It appears in the admin review list and case information, and can be edited there. New cases store the two fields in `cases.settings.authorName` and `institutionName`; intake extracts only explicit credits from the source. Older cases display explicit attribution found in their saved case history, including the template's “Author name and institution” entry. Missing credit remains Unknown until an editor supplies it.

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
