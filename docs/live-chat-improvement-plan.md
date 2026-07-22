# PLAN: Live Chat Improvements (vetwebappprod)

> **Goal:** Bring the **Gemini Live Chat** feature to feature-parity with the classic **TTS-STT Chatbot** (`features/chat/*`): persistent written record of clinical interviews, explicit OWNER ↔ NURSE separation with cross-tab visibility, same message model and persistence layer, and the same completion/advance machinery. Fix ten concrete latent bugs found during architectural inspection.

---

## 0. Context: Live vs Chat Asymmetry (gap map)

| Concern | Classic Chat (TTS/STT) | Live Chat (current) | Gap |
|---|---|---|---|
| Message model | `Message` (`features/chat/models/chat.ts`) — id, role, timestamp, stageIndex, displayRole, portraitUrl, structuredFindings, labResults, media, status | `TranscriptEntry` (`features/live/types.ts`) — only id, speaker, text, timestamp | **Different shape** → no reuse |
| Persistence | `useSaveAttempt` → `attempts.messages` (jsonb), throttled auto-save on every change | In-memory only; `onSessionEnd` receives finalTranscript → discarded by page | **Lost on reload** |
| Personas | PersonaTabs (OWNER/NURSE/LAB) always visible; Active highlighted | One speaker at a time, switched on stage change; unclear who-is-talking when focused elsewhere | **No cross-tab indicator** |
| Transcript UI | Scrollable list of `ChatMessage` with portrait, role, timestamp, coll>500 chars Show More, retry button on fail, lab results tables, media renderer | One-line truncated single entry that auto-fades; no scroll, no timestamps, no retry | **Single-line fade** |
| Stage completion | `STAGE_COMPLETION_RULES` evaluator: minUserTurns, minAssistantTurns, assistantKeywords; per-case overrides | Heuristic `progress.canAdvance` from raw turn counter; broken re-accumulation on stage change | **No completion evaluator** |
| Advance UX | Inline confirm banner (YES/NO), rollback detection, intent detector, lock window | Single button always clickable when `canAdvance` | **No confirmation UX** |
| Notepad | `Notepad` component per case+attempt in localStorage | Not present | **Missing** |
| Guided mode | `guided-mode` localStorage + sidebar button + toggle event | Present in Chat, not surfaced in Live cleanly | **Drift** |
| Token delivery | n/a (LLM over server-side route, no API key in client) | `GEMINI_API_KEY` returned raw via `/api/live/token` | **XSS-style leak** |
| Persona switching mid-flow | PersonaTabs → next-message goes to selected tab; no reconnect | `live.switchPersona(persona)` → if voice differs → full disconnect+reconnect → audio drop | **Latency** |
| Feedback rendering | n/a | `feedback/route.ts` → markdown→HTML with naïve regex → XSS | **Sanitization** |

> **Conclusion:** The Live feature was built as a parallel implementation that never inherited the chat's data, UI, or completeness primitives. The plan below unifies on the chat primitives.

---

## 1. Phasing

> Priorities **P0..P3** map to: critical/data-loss → feature-parity core → UX polish → technical refactor.
> Each phase is a self-contained sprint deliverable. Pick a phase, paste into a sub-agent prompt.

```
FASE 0  Seguridad y datos               (P0)  ~4 tasks
FASE 1  Modelo de datos + persistencia  (P1)  ~6 tasks
FASE 2  Réplica arquitectura Chat        (P1)  ~6 tasks
FASE 3  UX polish y feedback             (P2)  ~8 tasks
FASE 4  Refactor técnico                 (P3)  ~4 tasks
                                                       Total ~28 tasks
```

---

## FASE 0 — Seguridad y datos (P0) 🔴

> **Why P0:** Security leak of API key + XSS via feedback are production-blocking. They MUST go first.

### P0.1 — Remove raw API key from client
- **Files:** `app/api/live/token/route.ts`, `features/live/services/geminiLiveService.ts`, possibly new `app/api/live/proxy/route.ts`
- **Action:** Investigate Gemini Live **Ephemeral Tokens** (`ai.google.dev/gemini-api/docs/ephemeral-tokens`) — they are short-lived, scope-restricted, and the canonical solution. As a fallback, add a server-side WebSocket proxy route that the client connects to; the server holds the Gemini connection and pipes audio.
- **Acceptance:** Opening DevTools/Network while connected shows no `GEMINI_API_KEY`. `Authorization: Bearer …` is not present in any client-side request.

### P0.2 — Sanitize feedback markdown
- **Files:** `app/api/live/feedback/route.ts` and any consumer (likely `app/api/case-sessions/[sessionId]/attempts/feedback/route.ts`)
- **Action:** Replace hand-rolled regex `**…**`, `*…*`, headings etc. with `marked` + `isomorphic-dompurify` (or `xss`). Render server-side and store the sanitized HTML.
- **Acceptance:** A feedback payload containing `<script>alert(1)</script>` is stored as escaped text and renders as literal text, not as a script execution.

### P0.3 — Distinguish user-navigation from network failure in reconnect loop
- **Files:** `features/live/components/live-session.tsx`
- **Action:** Add `userInitiatedDisconnectRef` set to `true` inside `handleEndSession` and the persona `useEffect` cleanup. Reconnect effect reads the ref and bails out if set.
- **Acceptance:** Leaving the page (or switching cases) cancels in-flight reconnect timer; only true network drops retry up to 3× with backoff.

### P0.4 — Stop sharing dynamic imports of `@/lib/auth-headers`
- **Files:** `features/live/components/live-session.tsx` (lines ~95, 145, 220)
- **Action:** Hoist to a single static `import { getAccessToken } from "@/lib/auth-headers";` at the top.
- **Acceptance:** No more `await import(...)` for `auth-headers`. Bundler emits one chunk reference.

---

## FASE 1 — Modelo de datos + persistencia Live (P1) 🟠

> **Why P1:** Without persistence, every page reload wipes the "clinical record" — which is the user's explicit requirement.

### P1.1 — Decide storage strategy for live transcript
- **Files:** new `db/create_live_transcripts.sql` or extend `attempts` schema
- **Recommended:** Reuse the existing `attempts.messages` jsonb. Live emits `Message[]` (after P1.2); saving is identical to chat → no migration needed. As a fallback, add table `live_transcripts (id, attempt_id, stage_index, speaker, role_key, text, started_at, ended_at, sequence)`.
- **Acceptance:** Reloading the page mid-session loads the entire prior dialogue. The schema supports per-attempt retrieval.

### P1.2 — Replace `TranscriptEntry[]` with `Message[]`
- **Files:** `features/live/types.ts`, `features/live/hooks/useGeminiLive.ts`, `features/live/services/geminiLiveService.ts`, `features/live/components/live-session.tsx`
- **Action:** Import `Message` from `features/chat/models/chat`. Map incoming SDK events:
  - `inputTranscription` → push `{role: "user", content: text, stageIndex, displayRole: "You", personaRoleKey: current, timestamp, status:"sent"}`
  - model `text` returned → push `{role:"assistant", content, stageIndex, displayRole: personaDisplayName, personaRoleKey, portraitUrl, voiceId, timestamp, status:"sent"}`
- **Acceptance:** `live.transcript` is `Message[]`. Reuse of `ChatMessage` rendering becomes trivial.

### P1.3 — Persist incrementally via `useSaveAttempt`
- **Files:** `features/live/components/live-session.tsx`, `features/attempts/hooks/useSaveAttempt.ts`, possibly a new `features/live/hooks/useSaveLive.ts`
- **Action:** On every new `Message` append (debounced ~600ms like chat), call `saveProgress(stageIndex, messages, elapsed)`. Also save on every stage advance and on `handleEndSession`.
- **Acceptance:** Reload after any turn restores the same messages. `time_spent_seconds` updates cumulatively.

### P1.4 — Capture `finalTranscript` in page on session end
- **Files:** `app/live/[id]/page.tsx`, `features/live/components/live-session.tsx`
- **Action:** Already calls `PATCH /api/live/session` with `currentStageIndex, status:"completed"`. Extend body to include `messages: Message[]`; server persists the final snapshot (best-effort dedupe against existing saved snapshot).
- **Acceptance:** Ending a session persists the last N messages without race with throttled saves.

### P1.5 — Fix turn-counter reset on stage change
- **Files:** `features/live/components/live-session.tsx` (the effect that does `prevUserTurnCountRef.current = 0`)
- **Action:** Replace the numeric delta with a `Set<string>` of already-counted entry IDs. On stage change, do NOT clear; the new stage filters by `entry.stage === currentStage` before counting. Or — align with chat evaluator (P2.6) and count per stage.
- **Acceptance:** After `History → Physical → Diagnostic`, only Mentalises the turns in the current stage. Advance hint lights up correctly.

### P1.6 — Server endpoint that hydrates attempts.messages on Live reload
- **Files:** `app/api/case-sessions/[sessionId]/attempts/[attemptId]/route.ts` or analogous
- **Action:** GET returns `{attemptId, messages, currentStageIndex, timeSpentSeconds}` for the current user.
- **Acceptance:** `app/live/[id]/page.tsx` fetches this first and seeds `LiveSession` initial state.

---

## FASE 2 — Réplica arquitectura Chat en Live (P1) 🟠

> **Why P1:** This is the user's explicit UX request: "separate windows/tabs between owner and nurse so they don't overlap", "keep/show a written record", "structure live cases in a similar way [to classic]".

### P2.1 — Use `PersonaTabs` (or extend it) on Live session
- **Files:** `features/chat/components/PersonaTabs.tsx`, `features/live/components/live-session.tsx`
- **Action:** Mount `PersonaTabs` at the top of Live. Show OWNER / NURSE / LAB always (disabled when not the active stage's persona, with tooltip "Switch to Stage X to address"). Highlight + animation on the active persona tab.
- **Acceptance:** Tabs present at all times. User can predict who's about to reply based on the active tab + stage.

### P2.2 — Replace `LiveTranscript` with scrollable chat-style history
- **Files:** `features/live/components/live-transcript.tsx` → either delete or rename to `LiveChatHistory.tsx`
- **Action:** Render `Message[]` via the **`ChatMessage`** component (`features/chat/components/chat-message.tsx`). Add `useEffect` auto-scroll to bottom on new message; manual scroll-up pauses auto-scroll. Use virtualization window if messages exceed 50.
- **Acceptance:** History pages of conversation remain readable. User can scroll back through entire dialogue. Show More / collapse triggers for long content. Retry button appears on `status:"failed"`.

### P2.3 — Per-persona log filtering
- **Files:** `features/live/components/live-session.tsx`, `features/live/components/live-transcript.tsx`
- **Action:** Switch the visible history filter when persona tab changes: OWNER tab shows only messages where `personaRoleKey === "owner"` or `role === "user"`; NURSE tab shows nurse + user messages; etc. Always show user messages in every tab (the "common floor").
- **Acceptance:** Each tab never shows the OTHER persona's reply. User messages are visible across tabs. Audio-visual focus matches the displayed speaker (persona tab is highlighted when that persona's audio is playing — see P3.1).

### P2.4 — Surface the `Notepad` component in Live
- **Files:** `features/chat/components/notepad.tsx`, `features/live/components/live-session.tsx`
- **Action:** Toggle button next to mic — opens the same `Notepad` with the same `osce-notes-{caseId}-{attemptId}` key. Student can jot findings during the live interview.
- **Acceptance:** Notes persist across reload. Two-way feature parity with text chat.

### P2.5 — Replace `LiveStageProgress` pills with `progress-sidebar.tsx`
- **Files:** `features/live/components/live-stage-progress.tsx`, `features/live/components/live-session.tsx`
- **Action:** Embed `ProgressSidebar` on the left. Allow click-to-jump (already supported in chat). Add guard: cannot jump ahead past "ready" stages without confirmation.
- **Acceptance:** 1:1 visual parity with text-chat page; clicking a future stage either advances immediately (if authorized) or shows the same confirmation dialog as chat.

### P2.6 — Bootstrap `STAGE_COMPLETION_RULES` for Live
- **Files:** `features/live/hooks/useLiveProgress.ts`, new shared `features/stages/services/stageCompletionEvaluator.ts` (extract from chat if non-existent)
- **Action:** Port `STAGE_COMPLETION_RULES`, `PHYSICAL_EXAM_KEYWORDS`, `STAGE_KEYWORD_SYNONYMS` into a shared evaluator. Live and Chat use the same evaluator. Map `Live TranscriptEntry.text` → `Message.content` for keyword scanning; treat `[SYS_TRIGGER]` and hidden patterns as filtered out.
- **Acceptance:** `canAdvance` is true at the same moments in Live as in Chat for the same case/stage.

---

## FASE 3 — UX polish y feedback (P2) 🟡

### P3.1 — Cross-tab "Speaking" indicator
- **Files:** `features/chat/components/PersonaTabs.tsx`, `features/live/components/live-session.tsx`
- **Action:** When `live.isSpeaking && activePersona !== currentTabPersona`, the OTHER tab (where the speaker is) shows a pulsing dot + small waveform mini-icon. Clicking it switches focus to that tab.
- **Acceptance:** User on the NURSE tab hears Lab Tech reply → "LAB" tab starts pulsing; clicking it switches view + audio continues uninterrupted.

### P3.2 — Visible timestamp per message
- **Files:** `features/chat/components/chat-message.tsx` re-use; ensure Live renders the same.
- **Action:** Show `HH:MM` next to role. On hover, full ISO timestamp.
- **Acceptance:** Every message line shows time of utterance.

### P3.3 — Retry button on failed user message
- **Files:** `features/chat/components/chat-message.tsx`, Live integration.
- **Action:** User messages (transcript finals sent to LLM) with `status:"failed"` show Retry — re-sends text to backend `chatService`.
- **Acceptance:** A disconnect mid-send results in a visible Failed badge; clicking Retry resends and replaces status to `pending → sent`.

### P3.4 — Stage-advance confirmation banner
- **Files:** `features/live/components/live-session.tsx`, new `StageAdvanceConfirm.tsx`
- **Action:** When user clicks Next Stage, show inline banner "Did you finish with the **[stage role]**? [Yes, advance] [Stay]". Integrate with `lockStageIntent` + `STAGE_STAY_BLOCK_WINDOW_MS` from chat.
- **Acceptance:** First-stage click on Physical advances with confirmation; clicking Stay keeps the student in the stage and emits a hint toast.

### P3.5 — Persona "incoming" visual when stage changes
- **Files:** `features/live/components/persona-header.tsx`, `features/live/components/live-session.tsx`
- **Action:** On stage transition, before the audio reconnects, show "**[Nurse] is joining…**" with portrait fade-in. The previous persona's portrait fades out. Cancel disconnect+reconnect if voice is the same — use SDK `reconfigure` semantics if exposed; otherwise rename `switchPersona` to issue an `sendClientContent({systemInstruction})` for same-voice.
- **Acceptance:** Stage change latency drops to <300ms when voice stays the same. When voice changes, the visual cue masks the disconnect window.

### P3.6 — Export transcript to .txt / .md
- **Files:** new `features/live/services/transcriptExport.ts`, button in `features/live/components/live-controls.tsx`
- **Action:** Build markdown formatted `[HH:MM] **Role:** text`. Provide "Copy to clipboard" + "Download .md" actions.
- **Acceptance:** Student can save a clinical interview transcript to disk with the same fidelity as the on-screen display.

### P3.7 — Guided mode parity
- **Files:** `features/chat/services`, `features/live/components/live-session.tsx`
- **Action:** Ensure `guidedMode` localStorage is honored in Live and `FloatingGuidedPanel` shows the stage guidance per chat. Bind to `live.currentStageIndex` (same logic as chat).
- **Acceptance:** Toggling guided mode in Live shows student guidance; in chat shows same panel — no behavioral drift.

### P3.8 — Session timer + idle indicator
- **Files:** `features/live/components/live-controls.tsx`
- **Action:** Display elapsed `timeSpentSeconds` from `useLiveProgress` (MM:SS). When idle (no transcript delta in 30s) show subtle "still connected, waiting for you" hint.
- **Acceptance:** Persistent timer visible. Idle silent prompt appears after 30s without user turns.

---

## FASE 4 — Refactor técnico (P3) 🟢

### P4.1 — Migrate mic capture from ScriptProcessor to AudioWorklet
- **Files:** `features/live/hooks/useMicrophone.ts`, new `features/live/audio/mic-worklet.ts`
- **Action:** Replace deprecated `createScriptProcessor(4096, 1, 1)` with `audioWorklet.addModule(...)`, a `AudioWorkletProcessor` that posts Float32 chunks; main thread downsamples to PCM_s16le 16kHz before `live.sendAudio`.
- **Acceptance:** No console `ScriptProcessorNode is deprecated` warning. Audio thread no longer blocks the main thread every 256ms (verify via DevTools Performance).

### P4.2 — Robust resampling for non-16 kHz devices
- **Files:** `features/live/hooks/useMicrophone.ts`
- **Action:** Accept whatever the device offers (44.1/48 kHz), downsample with a simple band-limited interpolator or use `OfflineAudioContext`. Avoid the assumption `inputSampleRate === 16000` which fails on Safari.
- **Acceptance:** Mic works on Safari and Firefox without manual sampleRate override. No silence or distortion.

### P4.3 — Optimize mid-conversation persona/voice switch
- **Files:** `features/live/services/geminiLiveService.ts`, `features/live/hooks/usePersonaSwitcher.ts`
- **Action:** When voice stays the same and only system instruction changes → use `sendClientContent` with new instruction. When voice changes → schedule reconnect in background, keep audio playback alive (use `player.enqueue` of a "Changing persona…" prebuffered clip if available).
- **Acceptance:** Stage change purely instruction-only → zero reconnect. Voice-changing stage → no perceptible audio drop longer than 300ms.

### P4.4 — Tests for live persistence + reconnect logic
- **Files:** `features/live/__tests__/*.test.ts(x)`, `vitest.config.ts`
- **Action:** Add tests for: turn counter reset, reconnect bail on `userInitiatedDisconnect`, save/load roundtrip, persona switch routing per tab, message coalescing. Use the same Vitest setup as existing chat tests.
- **Acceptance:** `npx vitest run features/live` passes. Coverage ≥ 60% on changed files.

---

## 2. Cross-cutting checks (run at the end of every fase)

- [ ] `npx tsc --noEmit` (target files) — zero errors
- [ ] `npm test` or `npx vitest run` — no regressions
- [ ] No console warnings on a happy-path Live session (DevTools open)
- [ ] DevTools Network: no `Authorization: Bearer <GEMINI>` in client requests
- [ ] Reload mid-session restores the exact same `Message[]` in the View + storage

---

## 3. Suggested sprint ordering (1-week capacity)

| Sprint | Days | Fases | Outcome |
|---|---|---|---|
| S0 | 0.5 | F0 (P0) | No data loss, no API key leak, no XSS |
| S1 | 2 | F1 (P1.1–P1.6) | Live persists across reloads |
| S2 | 3–4 | F2 (P2.1–P2.6) | Visual parity with Chat: tabs, scrollable history, notepad, sidebar, completion evaluator |
| S3 | 1–2 | F3 (P3.1–P3.8) | Indicators, retry, advance banner, persona-incoming, export, guided mode, timer |
| S4 | 1 | F4 (P4.1–P4.4) | AudioWorklet, resampling, optimisations, tests |

---

## 4. Open questions for the user (clarify before S2 starts)

1. **Persona tabs at all times vs only-active-answer persona tab?** (Current proposal: all-always, click to switch focus. Switching mid-stay does NOT redirect the conversation — the LIVE persona is still driven by stage.)
2. **Persist notes in localStorage only (current Chat) or also in DB?** (Chat uses localStorage; S2.4 will match.)
3. **Stage rollback flow during Live?** (Chat has rollback handling. Live currently doesn't; should we add a "go back to previous stage" button in the sidebar?)
4. **Multi-language?** STUDENT-facing guidance is English; live STT may be in local language. Should the transcript export honor a target language?

---

## 5. Sub-agent prompts (ready to paste)

> **Sprint S0 (P0):**
> "Execute FASE 0 of `docs/live-chat-improvement-plan.md` only. Touch only the files listed. Stop after each P0.* task and show the diff. Do not touch any file outside P0.*."

> **Sprint S1 (P1):**
> "Execute FASE 1 of `docs/live-chat-improvement-plan.md`. The persistence schema decision is: reuse `attempts.messages` jsonb (do NOT create a new table). After each task: run `npx tsc --noEmit` on the touched files and report."

> **Sprint S2 (P2):**
> "Execute FASE 2 — adopt the chat primitives verbatim. Do NOT modify `features/chat/*` files except `PersonaTabs.tsx` if needed for cross-tab speaking indicator. Do NOT introduce new dependencies. Reuse `Message`, `ChatMessage`, `PersonaTabs`, `Notepad`, `ProgressSidebar` and the `STAGE_COMPLETION_RULES` evaluator."

> **Sprint S3 (P3):**
> "Execute FASE 3 — UX polish. No DB changes. No SDK changes. All work is components + a new `transcriptExport.ts`."

> **Sprint S4 (P4):**
> "Execute FASE 4 — refactor. Add the AudioWorklet module as `features/live/audio/mic-processor.ts` (new file). Migrate `useMicrophone` to load it via `audioContext.audioWorklet.addModule`. Provide unit tests under `features/live/__tests__/`."

---

## 6. Acceptance — definition of done for the whole plan

- A student in Live session reloads the page after speaking → sees their questions and the persona's replies as a scrollable list with portraits + timestamps.
- A stage change to a different persona shows a clear "speaking now: [Nurse]" indicator; the owner tab stops pulsing when nurse starts speaking.
- Reload → resume → advance → end-session: every text the student or persona spoke is in `attempts.messages`.
- DevTools shows no API key.
- The same case, run as Chat and as Live, ends with identical stored attempt (transcript per stage, advancement metrics, time spent).
- Audio capture does not warn about `ScriptProcessorNode`; persona switching doesn't interrupt audio for more than ~300ms.
