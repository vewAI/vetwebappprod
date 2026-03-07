# Configurable Stages — Step-by-Step Implementation Plan

> **Purpose:** This document is a self-contained prompt/guide that an LLM (or developer) can follow to implement the configurable stages system. Each phase is independent and can be committed separately. Read the companion spec at `features/stages/README.spec.md` first.

---

## Pre-Implementation: Understand the Current System

Before coding, read these files to understand what exists:

| File | What it does |
|------|--------------|
| `features/stages/types.ts` | `Stage` interface: `{ id, title, description, completed, role, roleInfoKey?, feedbackPromptKey? }` |
| `features/config/case-config.ts` | Hardcoded `caseConfig[caseId]: Stage[]` — 5 cases × 6 stages each |
| `features/stages/services/stageService.ts` | `getStagesForCase(caseId)` reads hardcoded config; `getActiveStagesForCase(caseId)` adds activation filtering |
| `features/chat/utils/persona-guardrails.ts` | `resolveChatPersonaRoleKey(stageTitle, displayRole)` — pattern-matches title → persona |
| `app/api/chat/route.ts` | Server-side chat: calls `getStagesForCase()`, resolves persona, injects prompts |
| `app/case/[id]/attempt/page.tsx` | Client: loads stages via `getActiveStagesForCase()`, passes to `ChatInterface` |
| `app/admin/case-stage-manager/page.tsx` | Admin: toggles stage activation, edits overrides |
| `features/role-info/services/roleInfoService.ts` | `roleInfoKey` → prompt template resolution |

---

## PHASE 1: Database Table + Seed Script

### Step 1.1: Create the migration SQL

Create file: `db/create_case_stages.sql`

```sql
-- Create the case_stages table for configurable per-case stage definitions
BEGIN;

CREATE TABLE IF NOT EXISTS public.case_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id text NOT NULL REFERENCES public.cases(id) ON DELETE CASCADE,
  sort_order integer NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  persona_role_key text NOT NULL DEFAULT 'owner',
  role_label text,
  role_info_key text,
  feedback_prompt_key text,
  stage_prompt text,
  transition_message text,
  is_active boolean NOT NULL DEFAULT true,
  min_user_turns integer DEFAULT 0,
  min_assistant_turns integer DEFAULT 0,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(case_id, sort_order)
);

CREATE INDEX IF NOT EXISTS idx_case_stages_case_id ON public.case_stages(case_id);
CREATE INDEX IF NOT EXISTS idx_case_stages_active ON public.case_stages(case_id, is_active, sort_order);

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_case_stages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_case_stages_updated_at
  BEFORE UPDATE ON public.case_stages
  FOR EACH ROW EXECUTE FUNCTION update_case_stages_updated_at();

-- RLS policies
ALTER TABLE public.case_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read case stages"
  ON public.case_stages FOR SELECT USING (true);

CREATE POLICY "Authenticated users can manage case stages"
  ON public.case_stages FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

COMMIT;
```

**Run this SQL** against your Supabase database.

### Step 1.2: Create the seed script

Create file: `scripts/seed-case-stages.ts`

This script reads the hardcoded `caseConfig` and inserts rows into `case_stages` for every case. It should be **idempotent** (skip cases that already have rows).

```typescript
/**
 * Seed script: populates case_stages from the hardcoded caseConfig.
 * Run with: npx tsx scripts/seed-case-stages.ts
 * 
 * Idempotent: skips cases that already have case_stages rows.
 */

import { caseConfig } from "../features/config/case-config";
import { resolveChatPersonaRoleKey } from "../features/chat/utils/persona-guardrails";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  for (const [caseId, stages] of Object.entries(caseConfig)) {
    // Check if already seeded
    const { count } = await supabase
      .from("case_stages")
      .select("id", { count: "exact", head: true })
      .eq("case_id", caseId);

    if (count && count > 0) {
      console.log(`Skipping ${caseId}: already has ${count} stages`);
      continue;
    }

    const rows = stages.map((stage, idx) => ({
      case_id: caseId,
      sort_order: idx,
      title: stage.title,
      description: stage.description,
      persona_role_key: resolveChatPersonaRoleKey(stage.title, stage.role),
      role_label: stage.role,
      role_info_key: stage.roleInfoKey ?? null,
      feedback_prompt_key: stage.feedbackPromptKey ?? null,
      stage_prompt: null,
      transition_message: null,
      is_active: true,
      min_user_turns: 0,
      min_assistant_turns: 0,
      settings: {},
    }));

    const { error } = await supabase.from("case_stages").insert(rows);
    if (error) {
      console.error(`Error seeding ${caseId}:`, error.message);
    } else {
      console.log(`Seeded ${caseId}: ${rows.length} stages`);
    }
  }
}

main().catch(console.error);
```

### Step 1.3: Add npm script

In `package.json`, add:
```json
"seed:stages": "npx tsx scripts/seed-case-stages.ts"
```

**Checkpoint:** Run the script. Verify with a Supabase query: `SELECT case_id, sort_order, title, persona_role_key FROM case_stages ORDER BY case_id, sort_order;`

---

## PHASE 2: Update the Stage Type

### Step 2.1: Extend the Stage interface

Edit: `features/stages/types.ts`

Add new optional fields to the existing `Stage` interface. Do NOT remove any existing fields — ensure backward compatibility.

```typescript
export interface Stage {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  role: string;                          // Keep for backward compat (= role_label)
  roleInfoKey?: string;                  // Keep — maps to prompt templates
  feedbackPromptKey?: string;            // Keep — maps to feedback prompts
  // --- NEW FIELDS ---
  personaRoleKey?: string;               // Explicit: "owner" | "veterinary-nurse"
  stagePrompt?: string;                  // Inline prompt override (alternative to roleInfoKey)
  transitionMessage?: string;            // Custom transition system message
  isActive?: boolean;                    // DB-driven activation flag
  sortOrder?: number;                    // Ordering
  settings?: Record<string, unknown>;    // Extensible settings
}

// DB row type for case_stages table
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

### Step 2.2: Add a mapping utility

Add to `features/stages/types.ts` (or a new `features/stages/utils.ts`):

```typescript
export function caseStageRowToStage(row: CaseStageRow): Stage {
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

**Checkpoint:** Run `npm run lint` — no errors. No consumer code changes needed yet because all new fields are optional.

---

## PHASE 3: API Routes

### Step 3.1: Create GET/PUT `/api/cases/[caseId]/stages`

Create file: `app/api/cases/[caseId]/stages/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { caseConfig } from "@/features/config/case-config";
import { resolveChatPersonaRoleKey } from "@/features/chat/utils/persona-guardrails";

type RouteParams = { params: Promise<{ caseId: string }> };

// GET: Return stages for a case (DB-first, hardcoded fallback)
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { caseId } = await params;
  if (!caseId) {
    return NextResponse.json({ error: "Missing caseId" }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  const { data: rows, error } = await supabase
    .from("case_stages")
    .select("*")
    .eq("case_id", caseId)
    .order("sort_order", { ascending: true });

  if (!error && rows && rows.length > 0) {
    return NextResponse.json({ stages: rows, source: "db" });
  }

  // Fallback to hardcoded
  const hardcoded = caseConfig[caseId] ?? caseConfig["case-1"];
  if (!hardcoded) {
    return NextResponse.json({ error: "No stages found" }, { status: 404 });
  }

  const fallbackRows = hardcoded.map((s, idx) => ({
    id: s.id,
    case_id: caseId,
    sort_order: idx,
    title: s.title,
    description: s.description,
    persona_role_key: resolveChatPersonaRoleKey(s.title, s.role),
    role_label: s.role,
    role_info_key: s.roleInfoKey ?? null,
    feedback_prompt_key: s.feedbackPromptKey ?? null,
    stage_prompt: null,
    transition_message: null,
    is_active: true,
    min_user_turns: 0,
    min_assistant_turns: 0,
    settings: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  return NextResponse.json({ stages: fallbackRows, source: "hardcoded" });
}

// PUT: Bulk-replace all stages for a case
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const { caseId } = await params;
  if (!caseId) {
    return NextResponse.json({ error: "Missing caseId" }, { status: 400 });
  }

  const body = await req.json();
  const stages = body.stages;
  if (!Array.isArray(stages)) {
    return NextResponse.json({ error: "stages must be an array" }, { status: 400 });
  }

  // Validate required fields
  for (const [i, s] of stages.entries()) {
    if (!s.title || typeof s.title !== "string") {
      return NextResponse.json({ error: `Stage ${i}: title is required` }, { status: 400 });
    }
    if (!s.persona_role_key || typeof s.persona_role_key !== "string") {
      return NextResponse.json({ error: `Stage ${i}: persona_role_key is required` }, { status: 400 });
    }
  }

  const supabase = getSupabaseAdminClient();

  // Delete existing stages for this case
  const { error: delError } = await supabase
    .from("case_stages")
    .delete()
    .eq("case_id", caseId);

  if (delError) {
    return NextResponse.json({ error: delError.message }, { status: 500 });
  }

  // Insert new stages with enforced sort_order
  const rows = stages.map((s: Record<string, unknown>, idx: number) => ({
    case_id: caseId,
    sort_order: idx,
    title: s.title,
    description: s.description ?? "",
    persona_role_key: s.persona_role_key,
    role_label: s.role_label ?? null,
    role_info_key: s.role_info_key ?? null,
    feedback_prompt_key: s.feedback_prompt_key ?? null,
    stage_prompt: s.stage_prompt ?? null,
    transition_message: s.transition_message ?? null,
    is_active: s.is_active !== false,
    min_user_turns: s.min_user_turns ?? 0,
    min_assistant_turns: s.min_assistant_turns ?? 0,
    settings: s.settings ?? {},
  }));

  const { data: inserted, error: insError } = await supabase
    .from("case_stages")
    .insert(rows)
    .select();

  if (insError) {
    return NextResponse.json({ error: insError.message }, { status: 500 });
  }

  return NextResponse.json({ stages: inserted, count: inserted?.length ?? 0 });
}
```

### Step 3.2: Create POST `/api/cases/[caseId]/stages/seed`

Create file: `app/api/cases/[caseId]/stages/seed/route.ts`

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { caseConfig } from "@/features/config/case-config";
import { resolveChatPersonaRoleKey } from "@/features/chat/utils/persona-guardrails";

type RouteParams = { params: Promise<{ caseId: string }> };

export async function POST(_req: NextRequest, { params }: RouteParams) {
  const { caseId } = await params;
  const supabase = getSupabaseAdminClient();

  // Check existing
  const { count } = await supabase
    .from("case_stages")
    .select("id", { count: "exact", head: true })
    .eq("case_id", caseId);

  if (count && count > 0) {
    return NextResponse.json({ seeded: false, reason: "already_exists", count });
  }

  const stages = caseConfig[caseId] ?? caseConfig["case-1"];
  if (!stages) {
    return NextResponse.json({ error: "No template found" }, { status: 404 });
  }

  const rows = stages.map((s, idx) => ({
    case_id: caseId,
    sort_order: idx,
    title: s.title,
    description: s.description,
    persona_role_key: resolveChatPersonaRoleKey(s.title, s.role),
    role_label: s.role,
    role_info_key: s.roleInfoKey ?? null,
    feedback_prompt_key: s.feedbackPromptKey ?? null,
    is_active: true,
  }));

  const { error } = await supabase.from("case_stages").insert(rows);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ seeded: true, count: rows.length });
}
```

**Checkpoint:** Test with curl/Postman:
- `GET /api/cases/case-1/stages` → returns hardcoded fallback (source: "hardcoded")
- `POST /api/cases/case-1/stages/seed` → seeds DB, returns { seeded: true, count: 6 }
- `GET /api/cases/case-1/stages` → returns DB rows (source: "db")

---

## PHASE 4: Update the Stage Service

### Step 4.1: Make `getStagesForCase` async and DB-aware

Edit: `features/stages/services/stageService.ts`

**Current code:**
```typescript
export function getStagesForCase(caseId: string): Stage[] {
  return caseConfig[caseId] || caseConfig["case-1"];
}
```

**Replace with:**
```typescript
import { caseStageRowToStage, type CaseStageRow } from "../types";

// Async version: reads DB first, falls back to hardcoded
export async function getStagesForCaseAsync(caseId: string): Promise<Stage[]> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || ""}/api/cases/${encodeURIComponent(caseId)}/stages`,
      { cache: "no-store" }
    );
    if (res.ok) {
      const data = await res.json();
      if (data.stages && data.stages.length > 0) {
        return data.stages.map((row: CaseStageRow) => caseStageRowToStage(row));
      }
    }
  } catch {
    // Fall through to hardcoded
  }
  return getStagesForCase(caseId);
}

// Keep synchronous version as fallback (used where async isn't possible)
export function getStagesForCase(caseId: string): Stage[] {
  return caseConfig[caseId] || caseConfig["case-1"];
}
```

**IMPORTANT:** Keep the synchronous `getStagesForCase()` as-is. All current consumers continue to work. New code should prefer `getStagesForCaseAsync()`. Migrate consumers one-by-one in later steps.

### Step 4.2: Update `getActiveStagesForCase`

**Current code** fetches `stageActivation` from `cases.settings` and filters.

**Replace the filtering logic** to use `isActive` from the DB stages instead:

```typescript
export async function getActiveStagesForCase(caseId: string): Promise<Stage[]> {
  const stages = await getStagesForCaseAsync(caseId);
  // If stages came from DB, they have isActive set. Filter by it.
  const active = stages.filter(s => s.isActive !== false);
  return active.length > 0 ? active : stages; // Safety: never return empty
}
```

Remove the old fetch to `/api/cases/{caseId}/stage-settings` — it's no longer needed for activation filtering.

**Checkpoint:** Run `npm run lint`. Verify the `attempt/page.tsx` still loads stages correctly by running `npm run dev` and loading a case.

---

## PHASE 5: Update Server-Side Chat (route.ts)

This is the most critical phase. The chat API must read DB stages and use `personaRoleKey` explicitly.

### Step 5.1: Import and call async stage loader

In `app/api/chat/route.ts`, find the section where stages are loaded (around line 148):

**Current:**
```typescript
const stages = getStagesForCase(caseId);
```

**Replace with a server-side Supabase query** (don't use the fetch-based `getStagesForCaseAsync` from the server — query directly):

```typescript
// Load stages from DB, fall back to hardcoded
let stages: Stage[] = getStagesForCase(caseId); // hardcoded fallback
const { data: dbStages } = await adminSupabase
  .from("case_stages")
  .select("*")
  .eq("case_id", caseId)
  .eq("is_active", true)
  .order("sort_order", { ascending: true });

if (dbStages && dbStages.length > 0) {
  stages = dbStages.map((row: any) => ({
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
    sortOrder: row.sort_order,
    settings: row.settings ?? {},
  }));
}
```

### Step 5.2: Use explicit `personaRoleKey` for persona resolution

Find the persona resolution block (around line 181):

**Current:**
```typescript
personaRoleKey = resolveChatPersonaRoleKey(stageDescriptor?.title ?? stageRole, displayRole);
```

**Replace with:**
```typescript
// Prefer explicit personaRoleKey from DB stage; fall back to title-based resolution
personaRoleKey = stage?.personaRoleKey
  ?? resolveChatPersonaRoleKey(stageDescriptor?.title ?? stageRole, displayRole);
```

This one-line change ensures that when a professor sets `persona_role_key` on a custom stage, it overrides the pattern-matching. The fallback preserves backward compatibility for hardcoded stages that don't have `personaRoleKey` set.

### Step 5.3: Support inline `stagePrompt`

Find where `roleInfoKey` is used to load the role prompt (search for `stage.roleInfoKey` or `roleInfoPrompt` in route.ts). Add a check:

```typescript
// If the stage has an inline stagePrompt, use it directly instead of roleInfoKey
if (stage?.stagePrompt) {
  roleInfoPrompt = stage.stagePrompt;
} else if (stage?.roleInfoKey) {
  // Existing roleInfoKey → roleInfoService resolution
  roleInfoPrompt = await resolveRoleInfoPrompt(caseId, personaRoleKey, stage);
}
```

### Step 5.4: Support custom transition messages

Find `getStageTransitionMessage(caseId, stageIndex)` usage. Add priority for DB-provided transition messages:

```typescript
const transitionMsg = stage?.transitionMessage
  ?? getStageTransitionMessage(caseId, stageIndex)?.content
  ?? `Proceeding to ${stage?.title ?? "next stage"}.`;
```

**Checkpoint:** Test by sending a chat message. Verify the persona resolution is correct. Check server logs for any Supabase errors.

---

## PHASE 6: Update Client-Side Consumers

### Step 6.1: `app/case/[id]/attempt/page.tsx`

This already calls `getActiveStagesForCase(id)` which was updated in Phase 4. **No code changes needed** — it should automatically get DB stages now.

Verify by console.log in the `useEffect` that loads stages — check that `stage.personaRoleKey` is present.

### Step 6.2: `app/attempts/[id]/page.tsx`

If this file calls `getStagesForCase()` or `getActiveStagesForCase()`, update it similarly to use the async version. The pattern is:
- Find: `getStagesForCase(caseId)` 
- Replace with: `getActiveStagesForCase(caseId)` (already async)

### Step 6.3: `chat-interface.tsx` persona resolution

Find where `resolveChatPersonaRoleKey(stage?.role, ...)` is called (line ~472).

**Add priority for explicit `personaRoleKey`:**
```typescript
const resolvedPersona = stage?.personaRoleKey
  ?? resolveChatPersonaRoleKey(stage?.role, stage?.role ?? "");
```

Apply the same pattern at every `resolveChatPersonaRoleKey` call site in `chat-interface.tsx` (there are 4-5 call sites).

### Step 6.4: `features/cases/components/case-media-editor.tsx`

This imports `getStagesForCase` to show stage labels in a dropdown. Update to use the async version:

```typescript
// Before: const stages = getStagesForCase(caseId);
// After:
const [stages, setStages] = useState<Stage[]>([]);
useEffect(() => {
  getActiveStagesForCase(caseId).then(setStages);
}, [caseId]);
```

### Step 6.5: `app/case-viewer/page.tsx`

Imports `caseConfig` directly. Update to use the async stage loader:

```typescript
// Before: const stages = caseConfig[selectedCaseId];
// After:
const [stages, setStages] = useState<Stage[]>([]);
useEffect(() => {
  getActiveStagesForCase(selectedCaseId).then(setStages);
}, [selectedCaseId]);
```

**Checkpoint:** Run `npm run dev`, load a case as a student — verify all 6 stages appear and persona switching works correctly. Load the case viewer — verify stages appear.

---

## PHASE 7: Admin UI Rewrite

### Step 7.1: Rewrite `/admin/case-stage-manager/page.tsx`

Replace the existing file entirely. The new version should:

1. **Load stages** via `GET /api/cases/{caseId}/stages`
2. **Display** as an ordered list of cards
3. **Each card** has:
   - Drag handle (or up/down arrow buttons for simplicity)
   - Title (text input)
   - Description (textarea)
   - Persona Role Key (dropdown: `owner`, `veterinary-nurse`)
   - Role Label (text input — the display name like "Client (Horse Owner)")
   - Role Info Key (dropdown: `getOwnerPrompt`, `getPhysicalExamPrompt`, `getDiagnosticPrompt`, `getOwnerFollowUpPrompt`, `getOwnerDiagnosisPrompt`, `getTreatmentPlanPrompt`, or "None")
   - Stage Prompt (textarea — alternative to roleInfoKey, for custom prompts)
   - Transition Message (textarea)
   - Active toggle (switch)
   - Min User Turns / Min Assistant Turns (number inputs)
   - Delete button (with confirmation)
4. **"Add Stage" button** at the bottom — adds a blank stage with defaults
5. **"Seed from Defaults" button** — calls `POST /api/cases/{caseId}/stages/seed`
6. **"Save" button** — calls `PUT /api/cases/{caseId}/stages` with the full array
7. **Reorder** — move-up/move-down buttons recalculate `sort_order`

**Key UI pattern:**
```tsx
// Pseudo-structure:
export default function CaseStageManager() {
  const [cases, setCases] = useState([]);
  const [selectedCase, setSelectedCase] = useState("");
  const [stages, setStages] = useState([]);
  const [source, setSource] = useState(""); // "db" or "hardcoded"
  const [isDirty, setIsDirty] = useState(false);

  // Load cases on mount
  // Load stages when selectedCase changes
  // Save = PUT /api/cases/{selectedCase}/stages
  // Seed = POST /api/cases/{selectedCase}/stages/seed, then reload

  return (
    <div>
      <CaseSelector ... />
      {source === "hardcoded" && <SeedButton ... />}
      <StageList stages={stages} onChange={setStages} />
      <AddStageButton onClick={addBlankStage} />
      <SaveButton disabled={!isDirty} onClick={save} />
    </div>
  );
}
```

### Step 7.2: Add "Seed All Cases" admin action (optional)

In the admin page at `/admin/page.tsx`, add a button that seeds all cases at once by looping through known case IDs and calling the seed endpoint for each.

**Checkpoint:** Navigate to `/admin/case-stage-manager`. Select a case. If not seeded, click "Seed from Defaults". Edit a stage title of description. Save. Reload — verify changes persisted. Add a new stage. Delete a stage. Reorder stages. Save and verify.

---

## PHASE 8: Cleanup & Deprecation

### Step 8.1: Deprecate `cases.settings.stageActivation`

Add a comment to `app/api/cases/[caseId]/stage-settings/route.ts`:
```typescript
// DEPRECATED: Stage activation is now managed via the case_stages.is_active column.
// This endpoint is kept for backward compatibility but should not be used for new code.
```

Do NOT delete the endpoint — it may be referenced by older code paths.

### Step 8.2: Deprecate `StageDefinition` type

Remove the unused `StageDefinition` interface from `features/stages/types.ts` (it was never imported anywhere).

### Step 8.3: Update documentation

Update `features/stages/README.spec.md` to reflect the implemented system.

---

## Testing Checklist

After all phases, verify:

- [ ] `GET /api/cases/case-1/stages` returns DB stages (after seeding)
- [ ] `GET /api/cases/nonexistent/stages` returns hardcoded fallback
- [ ] `PUT /api/cases/case-1/stages` with modified array persists correctly
- [ ] Chat works: send a message in stage 0 (History) → response from "owner" persona
- [ ] Chat works: advance to stage 1 (Physical) → response from "nurse" persona
- [ ] Admin: can add a custom stage with `persona_role_key: "owner"` and custom title
- [ ] Chat with custom stage: persona matches `persona_role_key`, not derived from title
- [ ] Admin: can reorder stages — stage 0 becomes "Physical Examination" if moved up
- [ ] Admin: can deactivate a stage — it disappears from student view
- [ ] Admin: "Seed from Defaults" populates a fresh case with the 6 standard stages
- [ ] `case_timepoints` still inject correctly (sequence_index maps to position in sorted active stages)
- [ ] Follow-up days (deriveDisplayStages) still work with DB stages
- [ ] `npm run lint` passes
- [ ] `npm run test` passes (run existing tests)

---

## Files Changed Summary

| Action | File | What Changes |
|--------|------|--------------|
| CREATE | `db/create_case_stages.sql` | New table migration |
| CREATE | `scripts/seed-case-stages.ts` | Seed script |
| CREATE | `app/api/cases/[caseId]/stages/route.ts` | GET/PUT API |
| CREATE | `app/api/cases/[caseId]/stages/seed/route.ts` | Seed API |
| EDIT | `features/stages/types.ts` | Add `personaRoleKey`, `CaseStageRow`, mapping fn |
| EDIT | `features/stages/services/stageService.ts` | Add `getStagesForCaseAsync()`, update `getActiveStagesForCase()` |
| EDIT | `app/api/chat/route.ts` | Read DB stages, use explicit `personaRoleKey` |
| EDIT | `app/case/[id]/attempt/page.tsx` | Minimal — already uses async loader |
| EDIT | `app/attempts/[id]/page.tsx` | Use async stage loader |
| EDIT | `features/chat/components/chat-interface.tsx` | Prefer `personaRoleKey` at resolve call sites |
| EDIT | `features/cases/components/case-media-editor.tsx` | Use async stage loader |
| EDIT | `app/case-viewer/page.tsx` | Use async stage loader |
| REWRITE | `app/admin/case-stage-manager/page.tsx` | Full CRUD admin UI |
| EDIT | `package.json` | Add `seed:stages` script |
| DEPRECATE | `app/api/cases/[caseId]/stage-settings/route.ts` | Add deprecation comment |
| DELETE | `features/stages/types.ts` (partial) | Remove unused `StageDefinition` |

**Do NOT modify or delete:**
- `features/config/case-config.ts` — stays as the template/fallback
- `features/stages/case1.ts` — stays for custom transition messages (fallback)
- `features/chat/utils/persona-guardrails.ts` — stays; `resolveChatPersonaRoleKey` becomes the fallback when `personaRoleKey` is missing

---

## Architecture Diagram

```
                    ┌─────────────────────────┐
                    │   case_stages (DB)       │  ← Source of truth
                    │   id, case_id, sort_order│
                    │   title, persona_role_key│
                    │   role_label, role_info_  │
                    │   key, stage_prompt, ...  │
                    └───────────┬──────────────┘
                                │
             ┌──────────────────┼──────────────────┐
             │                  │                   │
     GET /api/cases/      stageService         route.ts
     {id}/stages        getStagesForCaseAsync  (direct query)
             │                  │                   │
             │           ┌──────┴──────┐           │
             │           │  Fallback:  │           │
             │           │ caseConfig  │           │
             │           │ (hardcoded) │           │
             │           └─────────────┘           │
             │                                     │
      ┌──────┴──────┐                    ┌────────┴────────┐
      │  Admin UI   │                    │  Chat API       │
      │  (CRUD)     │                    │  stage.persona  │
      │  PUT stages │                    │  RoleKey used   │
      └─────────────┘                    │  directly       │
                                         └─────────────────┘
```
