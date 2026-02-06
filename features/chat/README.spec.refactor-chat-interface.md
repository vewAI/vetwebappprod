# Chat Interface Refactoring Plan

## Problem Statement
The `chat-interface.tsx` file has grown to over 5,900 lines, making it:
- Hard to understand and follow
- Difficult to debug and test
- Prone to merge conflicts
- Slow for AI assistants to analyze

## Refactoring Strategy: Incremental Extraction

We will extract logical groups of functionality into separate modules, prioritizing:
1. **Performance-critical paths** (persona loading, STT/TTS orchestration)
2. **High-merge-conflict areas** (UI components, event handlers)
3. **Reusable utilities** (already partially done)

---

## Phase 1: Persona System Extraction (IMMEDIATE PRIORITY)

### 1.1 Create `usePersonaDirectory` Hook
**File:** `features/chat/hooks/usePersonaDirectory.ts`

**Purpose:** Manage persona directory loading and caching.

**Key Changes:**
- Load personas ONCE per `caseId` (not on every render)
- Cache owner/nurse metadata in refs to avoid re-renders
- Provide stable `getPersonaMetadata(roleKey)` function
- Emit `personaDirectoryReady` event when loaded

**Interface:**
```typescript
export type PersonaEntry = {
  displayName?: string;
  portraitUrl?: string;
  voiceId?: string;
  sex?: "male" | "female";
};

export type UsePersonaDirectoryResult = {
  personaDirectory: Record<string, PersonaEntry>;
  isReady: boolean;
  getPersonaMetadata: (roleKey: string) => PersonaEntry | undefined;
  upsertPersona: (roleKey: string, entry: Partial<PersonaEntry>) => void;
};

export function usePersonaDirectory(caseId: string): UsePersonaDirectoryResult;
```

### 1.2 Create `PersonaButton` Component
**File:** `features/chat/components/PersonaButton.tsx`

**Purpose:** Render OWNER/NURSE button with portrait, memoized to prevent unnecessary re-renders.

**Props:**
```typescript
type PersonaButtonProps = {
  roleKey: "owner" | "veterinary-nurse";
  displayName: string;
  portraitUrl?: string;
  isActive: boolean;
  onClick: () => void;
  size?: "sm" | "lg";
};
```

---

## Phase 2: STT/TTS Orchestration Extraction

### 2.1 Create `useSpeechOrchestration` Hook
**File:** `features/chat/hooks/useSpeechOrchestration.ts`

**Extracts:**
- `playTtsAndPauseStt` function
- `safeStart` / `attemptStartListening` functions
- STT suppression refs (`isSuppressingSttRef`, `wasMicPausedForTtsRef`, etc.)
- TTS resume logic
- 4-second force-resume safety timer

### 2.2 Create `useVoiceMode` Hook
**File:** `features/chat/hooks/useVoiceMode.ts`

**Extracts:**
- Voice mode toggle logic
- Auto-send timer management
- Mic inactivity handling
- STT transcript processing

---

## Phase 3: Message Handling Extraction

### 3.1 Create `useChatMessages` Hook
**File:** `features/chat/hooks/useChatMessages.ts`

**Extracts:**
- Message state management
- `appendAssistantMessage` / `appendUserMessage`
- Message coalescing logic
- Duplicate detection

### 3.2 Create `useSendMessage` Hook
**File:** `features/chat/hooks/useSendMessage.ts`

**Extracts:**
- `sendUserMessage` function
- Server API call orchestration
- Response handling
- Error handling

---

## Phase 4: Stage Intent & Navigation

### 4.1 Create `useStageNavigation` Hook
**File:** `features/chat/hooks/useStageNavigation.ts`

**Extracts:**
- `handleProceed` function
- Stage intent detection
- Stage readiness evaluation
- Pending stage advance state

---

## Phase 5: UI Component Extraction

### 5.1 Extract `ChatControls` Component
**File:** `features/chat/components/ChatControls.tsx`

**Contains:**
- OWNER/NURSE buttons
- Voice mode control
- NEXT STAGE button
- Input area with Send button

### 5.2 Extract `ChatMessageList` Component
**File:** `features/chat/components/ChatMessageList.tsx`

**Contains:**
- Message grouping/bundling logic
- Message rendering
- Loading state

---

## Immediate Fix: Nurse Portrait Not Showing

### Root Cause Analysis
The nurse portrait sometimes doesn't show because:
1. `personaDirectory` is re-initialized as `{}` when the effect runs
2. There's a race condition between rendering and API response
3. The component re-renders before the API data arrives

### Solution
1. Use stable refs for initial render to show cached/placeholder
2. Add `useMemo` for portrait URLs to prevent unnecessary lookups
3. Consider adding a loading skeleton while personas load

---

## Implementation Order

1. **Week 1:** Phase 1 (Persona system) - Fixes nurse portrait issue
2. **Week 2:** Phase 2 (STT/TTS) - Most complex, high merge-conflict area
3. **Week 3:** Phase 3 (Messages) - Moderate complexity
4. **Week 4:** Phases 4-5 (Stage nav, UI) - Lower priority

---

## Testing Strategy

Each extracted hook should have:
1. Unit tests for core logic
2. Integration test with mocked dependencies
3. Ensure existing E2E tests pass

---

## Migration Pattern

For each extraction:
```tsx
// OLD: Everything inline in chat-interface.tsx
const [personaDirectory, setPersonaDirectory] = useState({});
// ... 200 lines of persona logic

// NEW: Use extracted hook
const { personaDirectory, getPersonaMetadata, isReady } = usePersonaDirectory(caseId);
```
