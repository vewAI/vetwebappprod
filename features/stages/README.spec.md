# Configurable Stages System — Micro-Spec

## User Story

Professors can define any number of stages, in any order, with any persona, for each case.
The current 6-stage hardcoded skeleton is preserved as the **default template** that seeds new cases.
The system reads stage definitions from the database at runtime, falling back to the hardcoded config only when no DB rows exist for a case.

---

## Current Architecture (What Exists)

### Hardcoded Stages
- **Source:** `features/config/case-config.ts` → `caseConfig[caseId]: Stage[]`
- **Shape:** `{ id, title, description, completed, role, roleInfoKey?, feedbackPromptKey? }`
- **5 cases** all share the same 6-stage skeleton (only `role` string varies by species)

### Stage Service
- `getStagesForCase(caseId)` — synchronous, reads hardcoded config, falls back to `case-1`
- `getActiveStagesForCase(caseId)` — async, calls above + fetches `/api/cases/{id}/stage-settings` to filter by `stageActivation` map

### Server-Side (chat API)
- `app/api/chat/route.ts` calls `getStagesForCase()` (hardcoded, no DB) to:
  - Resolve stage title/role → derive `personaRoleKey` via `resolveChatPersonaRoleKey()`
  - Fetch `case_timepoints` where `sequence_index === stageIndex` for prompt injection
  - Determine `roleInfoKey` → load system prompt from `roleInfoService`

### Admin Panel
- `/admin/case-stage-manager` — toggles stage activation, edits title/description overrides
- Overrides stored in `cases.settings` JSONB (`stageActivation`, `stageOverrides`)
- Server-side NEVER reads these overrides — only the client uses them

### Persona Resolution
- `resolveChatPersonaRoleKey(stageTitle, displayRole)` — pattern-matches stage title
- Only 2 persona keys: `"owner"` and `"veterinary-nurse"`
- Hardcoded regex: "history" → owner, "physical" → nurse, "diagnostic planning" → owner, etc.
- Custom stage titles BREAK this resolution (e.g., "Triage" won't match any pattern)

### Key Gaps
1. No DB table for stage definitions — everything is TypeScript
2. Server/client stage mismatch (server reads hardcoded, client reads filtered)
3. Persona resolution is title-dependent — custom titles break it
4. Timepoint–stage coupling is implicit (via `sequence_index = stageIndex`)
5. `roleInfoKey` is a closed enum — no way to define custom prompt templates

---

## Data Model

### New DB Table: `case_stages`

```sql
CREATE TABLE IF NOT EXISTS public.case_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id text NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  sort_order integer NOT NULL,                    -- 0-indexed ordering
  title text NOT NULL,                            -- "History Taking", "My Custom Stage"
  description text NOT NULL DEFAULT '',           -- Student-facing description
  persona_role_key text NOT NULL DEFAULT 'owner', -- "owner" | "veterinary-nurse" | future keys
  role_label text,                                -- Display label: "Client (Horse Owner)"
  role_info_key text,                             -- Maps to RolePromptKey for system prompt
  feedback_prompt_key text,                       -- Maps to feedback prompt function
  stage_prompt text,                              -- Optional inline prompt (replaces roleInfoKey)
  transition_message text,                        -- System message injected on stage enter
  is_active boolean NOT NULL DEFAULT true,        -- Replaces stageActivation map
  min_user_turns integer DEFAULT 0,               -- Replaces stageOverrides.minUserTurns
  min_assistant_turns integer DEFAULT 0,          -- Replaces stageOverrides.minAssistantTurns
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,    -- Extensible (minKeywordHits, etc.)
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(case_id, sort_order)
);

-- Index for common queries
CREATE INDEX idx_case_stages_case_id ON public.case_stages(case_id);
CREATE INDEX idx_case_stages_active ON public.case_stages(case_id, is_active, sort_order);

-- Auto-update timestamp trigger
CREATE TRIGGER update_case_stages_updated_at
  BEFORE UPDATE ON public.case_stages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE public.case_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read case stages"
  ON public.case_stages FOR SELECT USING (true);
CREATE POLICY "Service role can manage case stages"
  ON public.case_stages FOR ALL USING (auth.role() = 'service_role');
```

### TypeScript Interface (Updated)

```typescript
// features/stages/types.ts
export interface Stage {
  id: string;
  title: string;
  description: string;
  completed: boolean;           // Runtime state (not persisted)
  role: string;                 // Display role label (e.g., "Client (Horse Owner)")
  personaRoleKey: string;       // "owner" | "veterinary-nurse" — explicit, not derived
  roleInfoKey?: string;         // Prompt template key
  feedbackPromptKey?: string;   // Feedback prompt key
  stagePrompt?: string;         // Inline prompt override
  transitionMessage?: string;   // Custom transition system message
  isActive?: boolean;           // From DB, used for filtering
  sortOrder?: number;           // For ordering
  settings?: Record<string, unknown>;
}

export interface CaseStageRow {
  id: string;
  case_id: string;
  sort_order: number;
  title: string;
  description: string;
  persona_role_key: string;
  role_label: string | null;
  role_info_key: string | null;
  feedback_prompt_key: string | null;
  stage_prompt: string | null;
  transition_message: string | null;
  is_active: boolean;
  min_user_turns: number;
  min_assistant_turns: number;
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}
```

### Mapping Function: DB Row → Stage

```typescript
function caseStageRowToStage(row: CaseStageRow): Stage {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    completed: false,
    role: row.role_label ?? row.title,
    personaRoleKey: row.persona_role_key,
    roleInfoKey: row.role_info_key ?? undefined,
    feedbackPromptKey: row.feedback_prompt_key ?? undefined,
    stagePrompt: row.stage_prompt ?? undefined,
    transitionMessage: row.transition_message ?? undefined,
    isActive: row.is_active,
    sortOrder: row.sort_order,
    settings: row.settings,
  };
}
```

---

## API Contract

### GET `/api/cases/[caseId]/stages`

Returns all stages for a case (from DB, falling back to hardcoded).

**Response:**
```json
{
  "stages": [
    {
      "id": "uuid",
      "title": "History Taking",
      "description": "...",
      "persona_role_key": "owner",
      "role_label": "Client (Horse Owner)",
      "role_info_key": "getOwnerPrompt",
      "feedback_prompt_key": "getHistoryFeedbackPrompt",
      "stage_prompt": null,
      "transition_message": null,
      "is_active": true,
      "sort_order": 0,
      "min_user_turns": 0,
      "min_assistant_turns": 0,
      "settings": {}
    }
  ],
  "source": "db" | "hardcoded"
}
```

### PUT `/api/cases/[caseId]/stages`

Bulk-replaces all stages for a case (full array). Used by admin editor.

**Input:**
```json
{
  "stages": [
    {
      "id": "uuid-or-null-for-new",
      "title": "History Taking",
      "description": "...",
      "persona_role_key": "owner",
      "role_label": "Client (Horse Owner)",
      "role_info_key": "getOwnerPrompt",
      "feedback_prompt_key": "getHistoryFeedbackPrompt",
      "stage_prompt": null,
      "transition_message": null,
      "is_active": true,
      "sort_order": 0,
      "min_user_turns": 0,
      "min_assistant_turns": 0,
      "settings": {}
    }
  ]
}
```

**Response:** `{ "stages": [...savedRows], "count": N }`

### POST `/api/cases/[caseId]/stages/seed`

Seeds stages from the hardcoded template into the DB for a case (idempotent: skips if rows exist).

**Response:** `{ "seeded": true, "count": 6 }` or `{ "seeded": false, "reason": "already_exists" }`

---

## Component Tree

### Admin: Stage Configuration Editor
```
app/admin/case-stage-manager/page.tsx (REPLACE existing)
├── CaseSelector (dropdown)
├── StageList (drag-to-reorder list)
│   ├── StageCard[] (one per stage)
│   │   ├── DragHandle
│   │   ├── Title (editable input)
│   │   ├── Description (editable textarea)
│   │   ├── PersonaRoleKey (dropdown: "owner" | "veterinary-nurse")
│   │   ├── RoleLabel (editable input)
│   │   ├── RoleInfoKey (dropdown: known keys)
│   │   ├── StagePrompt (textarea: inline prompt override)
│   │   ├── TransitionMessage (textarea)
│   │   ├── IsActive (toggle switch)
│   │   ├── MinTurns (number inputs)
│   │   └── DeleteStageButton
│   └── AddStageButton (+ template dropdown)
├── SaveButton
└── SeedFromDefaultsButton (one-time seeding)
```

### Student: No UI changes
- `ChatInterface` receives `stages: Stage[]` exactly as now
- The `attempt/page.tsx` loader calls the updated `getStagesForCase()` which now reads from DB

---

## Critical Rules

1. **Persona resolution MUST use `personaRoleKey` from the stage** — never derive from title.
2. **Server-side (`route.ts`) MUST read stages from DB** via the same function the client uses.
3. **Fallback chain:** DB stages → hardcoded `caseConfig` → generic error.
4. **`sort_order` is the source of truth** for stage ordering. The client's `stageIndex` maps to the array index of the sorted, active stages.
5. **Timepoints remain separate.** The `case_timepoints.sequence_index` still maps to the stage's position in the active-sorted array. This is an implicit coupling that should be documented, but changing it is out of scope.
6. **The `roleInfoKey` system is preserved.** Known keys (`getOwnerPrompt`, etc.) continue to work. Custom stages can provide an inline `stagePrompt` instead.
7. **`case-config.ts` is NOT deleted.** It becomes the seed template — used by the `/stages/seed` endpoint and as the fallback when no DB rows exist.

---

## Migration Strategy

### Phase 1: Database + API (Backend)
1. Create `case_stages` table
2. Create `/api/cases/[caseId]/stages` GET/PUT routes
3. Create `/api/cases/[caseId]/stages/seed` POST route
4. Add seed migration script to populate DB from hardcoded config for existing cases

### Phase 2: Service Layer (Shared)
5. Update `stageService.getStagesForCase()` to be async — read DB first, fall back to hardcoded
6. Update `stageService.getActiveStagesForCase()` to filter by `is_active` from DB (not from `cases.settings`)
7. Add `personaRoleKey` field to the `Stage` type

### Phase 3: Server-side Consumers
8. Update `app/api/chat/route.ts` to use async `getStagesForCase()` and read `personaRoleKey` from stage
9. Update `resolveChatPersonaRoleKey()` to accept and prefer explicit `personaRoleKey`
10. Update `roleInfoService` to handle inline `stagePrompt` as an alternative to `roleInfoKey`

### Phase 4: Client-side Consumers
11. Update `app/case/[id]/attempt/page.tsx` to call async `getStagesForCase()`
12. Update `app/attempts/[id]/page.tsx` similarly
13. Update `app/case-viewer/page.tsx` to use DB stages

### Phase 5: Admin UI
14. Rewrite `/admin/case-stage-manager` with full CRUD (add/remove/reorder/edit stages)
15. Add "Seed from Defaults" button
16. Remove dependence on `cases.settings.stageActivation` (now using `is_active` column)

### Phase 6: Cleanup
17. Deprecate `cases.settings.stageActivation` and `stageOverrides` (leave in DB, stop reading)
18. Optionally run a one-time migration to populate `case_stages` for all existing cases
