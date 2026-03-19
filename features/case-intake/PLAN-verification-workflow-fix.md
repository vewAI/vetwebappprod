# Plan: Verification Chatbot Workflow Fix

> **Purpose**: Precise implementation plan for a smaller model (GLM 4.6) to follow step by step.
> All 5 original files already exist and work. This plan fixes the **workflow** so that AI-suggested
> values are NOT silently written into the form — they go through the verification chatbot
> field by field for the professor to approve, edit, or skip.

---

## Current State (What Already Exists)

| File | Status |
|------|--------|
| `features/case-intake/models/caseVerification.ts` | ✅ Complete, no changes needed |
| `features/case-intake/services/caseVerificationService.ts` | ✅ Complete, no changes needed |
| `app/api/case-intake/verify/route.ts` | ✅ Complete (uses `gpt-4o-mini`), no changes needed |
| `app/api/case-intake/verify-chat/route.ts` | ✅ Complete (uses `gpt-4o-mini`), no changes needed |
| `features/case-intake/components/VerificationChatbot.tsx` | ⚠️ Needs 3 targeted edits |
| `app/case-entry/page.tsx` | ⚠️ Needs 2 targeted edits |
| `app/api/cases/route.ts` | ✅ `normalizeCaseBody` already strips `nurse_persona_config` / `owner_persona_config` |

### Previously Reported Errors — Already Resolved

1. **`nurse_persona_config` column not in DB**: `normalizeCaseBody()` in `app/api/cases/route.ts` (lines 47-48) already deletes `owner_persona_config` and `nurse_persona_config` before DB insert. No further fix needed. If it recurs, the issue is in a code path other than the cases POST route.
2. **`gpt-4o` 403 Forbidden**: All routes already use `"gpt-4o-mini"`. Grep confirmed no code file references the bare `"gpt-4o"` model string. Only the old plan doc has it.

---

## Problem Description

**Current flow** (broken):
1. Professor pastes case text → clicks "Analyze and Verify Case"
2. `handleAnalyzeCaseSource` calls `/api/case-intake/analyze`
3. Returns `draftCase` with AI-extracted values for ~25 fields
4. **`applyDraftToForm(result.draftCase)` immediately writes ALL values into the form** ← PROBLEM
5. Then auto-launches verification chatbot for missing items

**Desired flow** (to implement):
1. Professor pastes case text → clicks "Analyze and Verify Case"
2. `handleAnalyzeCaseSource` calls `/api/case-intake/analyze`
3. Returns `draftCase` with AI-extracted values
4. **Only "identity" fields** (species, condition, category, title, patient_name, patient_age, patient_sex) are written to the form immediately (they're needed by the verify endpoint)
5. **All clinical fields** (physical_exam_findings, diagnostic_findings, details, owner_background, history_feedback, prompts, etc.) are stored in a separate `pendingDraft` state — NOT written to form
6. Auto-chain to verification: passes the FULL draft to the verify endpoint
7. Verification chatbot opens. For **each item**:
   - If the AI already suggested a value (alreadyPresent === true), show the value and ask the professor to **Approve**, **Edit**, or **Skip**
   - If missing, ask the professor to provide it (existing behavior)
   - When approved/answered, the value is written to the form via `onFieldResolved`
8. Professor reviews field by field with the fierce chatbot guide

---

## Edits Required

### EDIT 1: `app/case-entry/page.tsx` — Store draft separately, don't auto-apply clinical fields

**Location**: Inside `CaseEntryForm` component, around lines 56-58 (state declarations) and lines 92-132 (handleAnalyzeCaseSource).

#### Step 1A: Add identity fields constant (after imports, before component)

Find this block (approximately line 40-42):

```typescript
function isCaseFieldKey(value: string): value is CaseFieldKey {
  return Boolean(getFieldMeta(value));
}
```

INSERT immediately BEFORE that function:

```typescript
/** Fields safe to auto-apply without chatbot review (basic metadata, not clinical content) */
const IDENTITY_FIELDS: ReadonlySet<string> = new Set([
  "id", "title", "species", "condition", "category",
  "patient_name", "patient_age", "patient_sex",
  "difficulty", "estimated_time", "region",
]);
```

#### Step 1B: Replace `applyDraftToForm` + auto-chain logic in `handleAnalyzeCaseSource`

Find this exact block inside `handleAnalyzeCaseSource` (approximately lines 115-132):

```typescript
      applyDraftToForm(result.draftCase ?? {});

      // Auto-launch verification chatbot so the professor reviews AI suggestions field by field
      setSuccess("AI analysis complete. Launching clinical verification...");
      setIsVerifying(true);
      try {
        const formWithDraft = { ...createEmptyCaseFormState() };
        for (const [key, value] of Object.entries(result.draftCase ?? {})) {
          if (isCaseFieldKey(key)) formWithDraft[key] = String(value ?? "");
        }
        const verifyResult = await caseVerificationService.verify(formWithDraft);
        setVerificationResult(verifyResult);
        setShowVerificationChat(true);
        setSuccess("Clinical verification ready. Review each item with the AI guide.");
      } catch (verifyErr) {
        const msg = verifyErr instanceof Error ? verifyErr.message : String(verifyErr);
        setError(msg || "Analysis succeeded but verification failed. You can retry below.");
      } finally {
        setIsVerifying(false);
      }
```

REPLACE with:

```typescript
      // Split draft: identity fields go straight to form, clinical fields wait for chatbot review
      const draft = result.draftCase ?? {};
      const identityPatch: Record<string, string> = {};
      for (const [key, value] of Object.entries(draft)) {
        if (!isCaseFieldKey(key)) continue;
        if (IDENTITY_FIELDS.has(key)) {
          identityPatch[key] = String(value ?? "");
        }
      }
      // Apply only identity fields to the form immediately
      if (Object.keys(identityPatch).length > 0) {
        applyDraftToForm(identityPatch);
      }

      // Auto-launch verification chatbot so the professor reviews AI suggestions field by field
      setSuccess("AI analysis complete. Launching clinical verification...");
      setIsVerifying(true);
      try {
        // Pass the FULL draft to verify so it can see what the AI suggested
        const formWithDraft = { ...createEmptyCaseFormState() };
        for (const [key, value] of Object.entries(draft)) {
          if (isCaseFieldKey(key)) formWithDraft[key] = String(value ?? "");
        }
        const verifyResult = await caseVerificationService.verify(formWithDraft);
        setVerificationResult(verifyResult);
        setShowVerificationChat(true);
        setSuccess("Clinical verification ready. Review each AI suggestion with the guide.");
      } catch (verifyErr) {
        const msg = verifyErr instanceof Error ? verifyErr.message : String(verifyErr);
        setError(msg || "Analysis succeeded but verification failed. You can retry below.");
      } finally {
        setIsVerifying(false);
      }
```

**What changed**: Only identity/metadata fields are applied to the form immediately. Clinical fields remain only in the draft passed to the verify endpoint. The verify endpoint evaluates them and flags them as "alreadyPresent" items. The chatbot then shows those values for the professor to approve or edit before they're written to the form.

---

### EDIT 2: `features/case-intake/components/VerificationChatbot.tsx` — Show existing values and write on confirm

Three sub-edits in this file:

#### Step 2A: Fix `handleConfirmPresent` to write the value to the form

Find this exact block (approximately lines 242-258):

```typescript
  const handleConfirmPresent = useCallback(() => {
    if (!activeItem) return;
    setItems((prev) =>
      prev.map((item, idx) =>
        idx === activeItemIndex ? { ...item, status: "accepted" } : item
      )
    );
    const nextIdx = items.findIndex(
      (item, idx) =>
        idx > activeItemIndex &&
        item.status === "pending" &&
        item.relevance !== "unnecessary"
    );
    if (nextIdx !== -1) {
      setActiveItemIndex(nextIdx);
    }
  }, [activeItem, activeItemIndex, items]);
```

REPLACE with:

```typescript
  const handleConfirmPresent = useCallback(() => {
    if (!activeItem) return;
    // Write the existing value into the form when the professor confirms
    if (activeItem.existingValue) {
      onFieldResolved(activeItem.targetField, activeItem.existingValue, "append");
    }
    setItems((prev) =>
      prev.map((item, idx) =>
        idx === activeItemIndex ? { ...item, status: "accepted" } : item
      )
    );
    const nextIdx = items.findIndex(
      (item, idx) =>
        idx > activeItemIndex &&
        item.status === "pending" &&
        item.relevance !== "unnecessary"
    );
    if (nextIdx !== -1) {
      setActiveItemIndex(nextIdx);
    }
  }, [activeItem, activeItemIndex, items, onFieldResolved]);
```

**What changed**: Added `onFieldResolved(...)` call so confirming a present item actually writes its value to the form. Added `onFieldResolved` to the dependency array.

#### Step 2B: Show the existing value in the quick-action bar for already-present items

Find this exact block (approximately lines 395-407):

```typescript
                {activeItem.alreadyPresent && activeItem.status === "pending" && (
                  <div className="px-4 py-2 border-t bg-blue-50 flex items-center gap-2 text-sm">
                    <span>This data is already in the case.</span>
                    <Button size="sm" onClick={handleConfirmPresent}>
                      Confirm
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => {/* open chat */}}>
                      Edit
                    </Button>
                  </div>
                )}
```

REPLACE with:

```typescript
                {activeItem.alreadyPresent && activeItem.status === "pending" && (
                  <div className="px-4 py-2 border-t bg-blue-50 space-y-2 text-sm">
                    <div className="font-medium text-blue-800">AI-suggested value:</div>
                    <pre className="whitespace-pre-wrap text-xs bg-white border border-blue-200 rounded p-2 max-h-32 overflow-y-auto">
                      {activeItem.existingValue || "(empty)"}
                    </pre>
                    <div className="flex items-center gap-2">
                      <Button size="sm" onClick={handleConfirmPresent}>
                        Approve
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setInputText(activeItem.existingValue || "")}>
                        Edit
                      </Button>
                      <Button size="sm" variant="ghost" onClick={handleSkip}>
                        Skip
                      </Button>
                    </div>
                  </div>
                )}
```

**What changed**:
- Shows the actual `existingValue` in a readable `<pre>` block so the professor sees exactly what the AI suggested
- "Confirm" renamed to "Approve" (clearer intent)
- "Edit" button now populates the chat input with the existing value so the professor can modify it and send
- Added "Skip" button for items the professor doesn't want
- Layout changed to vertical stack for readability when values are multiline

#### Step 2C: Improve auto-greet message for already-present items to include the value

Find this exact block (approximately lines 100-113):

```typescript
  // Auto-greet when switching to a new item with no history
  useEffect(() => {
    if (!activeItem) return;
    if (chatHistories[activeItem.id]?.length) return;

    const greeting: VerificationChatMessage = {
      id: `greeting-${activeItem.id}`,
      role: "assistant",
      content: activeItem.suggestedPrompt || `Could you provide information about: ${activeItem.itemName}?`,
      verificationItemId: activeItem.id,
      timestamp: new Date().toISOString(),
    };

    setChatHistories((prev) => ({
      ...prev,
      [activeItem.id]: [greeting],
    }));
  }, [activeItem, chatHistories]);
```

REPLACE with:

```typescript
  // Auto-greet when switching to a new item with no history
  useEffect(() => {
    if (!activeItem) return;
    if (chatHistories[activeItem.id]?.length) return;

    let greetingText: string;
    if (activeItem.alreadyPresent && activeItem.existingValue) {
      greetingText =
        `The AI extracted this for **${activeItem.itemName}**:\n\n` +
        `> ${activeItem.existingValue.split("\n").join("\n> ")}\n\n` +
        `Does this look correct and complete? You can **Approve** it as-is, ` +
        `click **Edit** to modify it, or we can discuss what's missing. ` +
        `${activeItem.reasoning}`;
    } else {
      greetingText = activeItem.suggestedPrompt || `Could you provide information about: ${activeItem.itemName}?`;
    }

    const greeting: VerificationChatMessage = {
      id: `greeting-${activeItem.id}`,
      role: "assistant",
      content: greetingText,
      verificationItemId: activeItem.id,
      timestamp: new Date().toISOString(),
    };

    setChatHistories((prev) => ({
      ...prev,
      [activeItem.id]: [greeting],
    }));
  }, [activeItem, chatHistories]);
```

**What changed**: When the item already has an AI-suggested value, the greeting message shows the value in a quote block and invites the professor to approve, edit, or discuss. For missing items, behavior is unchanged.

---

## Summary of All Changes

| # | File | What | Lines (approx) |
|---|------|------|-----------------|
| 1A | `app/case-entry/page.tsx` | Add `IDENTITY_FIELDS` constant before `isCaseFieldKey` | ~40 |
| 1B | `app/case-entry/page.tsx` | Replace `applyDraftToForm` + auto-chain block in `handleAnalyzeCaseSource` | ~115-132 |
| 2A | `VerificationChatbot.tsx` | Fix `handleConfirmPresent` to call `onFieldResolved` | ~242-258 |
| 2B | `VerificationChatbot.tsx` | Show existingValue in quick-action bar, add Approve/Edit/Skip | ~395-407 |
| 2C | `VerificationChatbot.tsx` | Improve auto-greet to show AI value for present items | ~100-113 |

Total: **5 targeted edits** across **2 files**. No new files. No model changes. No API changes.

---

## Verification After Implementation

1. **No TypeScript errors**: Run `npx tsc --noEmit` — should pass.
2. **Lint clean**: Run `npm run lint` — should pass.
3. **Manual test flow**:
   - Paste a case text → click "Analyze and Verify Case"
   - Form should only show identity fields (species, condition, title, etc.)
   - Form should NOT show values in clinical fields (physical_exam_findings, diagnostic_findings, etc.) until chatbot approval
   - Verification chatbot should open automatically
   - For items with AI suggestions → chatbot shows the value, Approve/Edit/Skip buttons available
   - Clicking "Approve" writes the value to the form
   - Clicking "Edit" populates the input so the professor can modify
   - For missing items → chatbot asks the professor (existing behavior)
   - After finishing, form fields should contain only approved values
4. **Save case**: After verification, click "Save Case" — should succeed without `nurse_persona_config` or `gpt-4o` errors.

---

## Files NOT Modified (and why)

- **`models/caseVerification.ts`**: Interfaces are already correct. `existingValue` and `alreadyPresent` fields already exist.
- **`services/caseVerificationService.ts`**: API calls are already correct.
- **`app/api/case-intake/verify/route.ts`**: Already uses `gpt-4o-mini`, already returns `alreadyPresent` and `existingValue`.
- **`app/api/case-intake/verify-chat/route.ts`**: Already uses `gpt-4o-mini`, fierce prompt already correct.
- **`app/api/cases/route.ts`**: `normalizeCaseBody` already strips persona_config fields.
