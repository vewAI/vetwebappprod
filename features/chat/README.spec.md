# Multi-Parameter Physical Exam — Micro-Spec

User story
- As a clinician using the chat nurse persona, I want to request multiple physical exam parameters in a single prompt (for example: "hr, rr, temp") and receive a single assistant response containing all requested parameters (if present) in a concise conversational format so I can continue the case workflow without being asked unnecessary clarifying questions.

Goals & constraints
- Support comma-, space-, and `and`-separated lists of parameters (e.g., `hr, rr, temp`, `hr rr temp`, `hr and rr`).
- Map shorthand tokens (e.g., `hr`) and common aliases (e.g., `pulse`) to canonical keys.
- Return all matched findings from the case's `physical_exam_findings` (no partial answering).
- If a requested key has no matching line, list it as "not documented" rather than prompting for clarification.
- Preserve existing RAG and stage guardrails: when case stage is `physical` only physical findings may be returned; lab-stage guardrails must still block lab requests.
- Keep changes small, testable, and reversible.

Data model (TypeScript interfaces)

interface RequestedKeys {
  raw: string; // original user text parsed for requested keys
  tokens: string[]; // normalized tokens (lowercase, trimmed)
  canonical: string[]; // mapped canonical keys (e.g., 'heart_rate')
}

interface PhysMatchResult {
  canonicalKey: string; // canonical param key
  aliases: string[]; // matched aliases from user token
  lines: string[]; // matching lines from physical_exam_findings
}

API contract / integration point
- This feature touches server-side chat handler at `app/api/chat/route.ts` inside the branch of code that handles `isPhysicalStage` or physical-exam related requests.
- Implement a pure helper module (e.g., `features/chat/services/physFinder.ts`) that exposes:
  - `parseRequestedKeys(text: string): RequestedKeys`
  - `matchPhysicalFindings(requested: RequestedKeys, findingsText: string): PhysMatchResult[]`

- `app/api/chat/route.ts` will call these helpers and merge results into the assistant's content. The chat handler must:
  - Not change persona or RAG logic except to add an additional `findings` structure to the assistant payload.
  - Ensure `isAdmin` and owner RAG sanitization remain intact.

Parsing rules & alias map
- Normalize input: lowercase, remove filler words (`please`, `give`, `values`), separate tokens by commas, `and`, or whitespace.
- Token normalization examples:
  - `hr` -> `heart_rate`
  - `pulse` -> `heart_rate`
  - `rr` -> `respiratory_rate`
  - `temp`, `temperature` -> `temperature`
  - `mmhg` suffix should be allowed but trimmed from key tokens (e.g., `bp 120/80 mmHg` -> key `blood_pressure`).
- PHYS_SYNONYMS (starter):
  - `heart_rate`: ["hr", "heart rate", "pulse"]
  - `respiratory_rate`: ["rr", "respiratory rate"]
  - `temperature`: ["temp", "temperature", "t"]
  - `blood_pressure`: ["bp", "blood pressure"]

Matching strategy
- Tokenize `physical_exam_findings` into lines. For each canonical key, search for lines containing any alias tokens with simple word-boundary matching.
- Matching should be deterministic and exact-ish (no heavy fuzzy). If needed, lowercase both line and alias and require substring or word match.
- Return all lines that match any alias for the requested canonical key.

Response formatting (assistant output)
- Compose a short conversational paragraph that lists each requested parameter followed by the finding or "not documented".
- Example output for request `hr, rr, temp`:

"Heart rate: 88 bpm (documented). Respiratory rate: 20 breaths/min (documented). Temperature: not documented in the physical exam."

- The nurse persona should not add clinical interpretation unless explicitly asked — keep to documented values.

Acceptance criteria (tests & manual)
- Unit tests for `parseRequestedKeys` with inputs:
  - `hr, rr, temp` -> canonical `["heart_rate","respiratory_rate","temperature"]`
  - `pulse and temp` -> canonical `["heart_rate","temperature"]`
  - `hr rr temp` -> canonical `["heart_rate","respiratory_rate","temperature"]`

- Unit tests for `matchPhysicalFindings` using sample `physical_exam_findings` text (multi-line) asserting returned `PhysMatchResult` contains expected `lines` for keys.

- Integration test: simulate a chat request in physical stage asking for multiple keys and assert assistant JSON contains combined findings and no "Which parameter" followup.

Developer notes & safety
- Keep helper functions pure and well-typed so they are easily unit-testable.
- Log matching decisions only in dev mode (e.g., DEBUG flag) to avoid leaking case data to logs in production.
- Respect existing owner-guardrails: remove patient-identifying owner data before sending to LLM; do not add additional RAG sources.

Implementation plan (small commits)
1. Add `features/chat/services/physFinder.ts` with parsing and alias map and unit tests.
2. Add unit tests under `features/chat/__tests__/` (`parse.test.ts`, `match.test.ts`).
3. Wire the helper into `app/api/chat/route.ts` in the physical-stage branch; add dev-only logs.
4. Run `npm run build`, fix type or lint issues, run unit tests.
5. Open PR with spec, tests, and code; request review.

Examples and edge cases
- If user asks for parameters but includes a non-physical key (e.g., `creatinine`), the handler should: (a) if in physical stage, respond that labs are not available; (b) if not in physical stage, follow existing lab-finding logic.
- If the user's text is ambiguous (e.g., `vitals`), return the canonical group mapping (e.g., `vitals` -> `heart_rate, respiratory_rate, blood_pressure, temperature`) or ask for clarification only when necessary.

Test data (suggested fixture)
- Provide a small `fixtures/physical_findings.txt` with lines like:
  - "Heart rate: 88 bpm"
  - "Respiratory rate 20/min"
  - "Mucous membranes: pink"

End of spec

---

# Chatbox Voice UI & Persona Tabs — Micro-Spec

User stories
- As a clinician using the chat, I want a clear choice of input mode (SPEAK or WRITE) so I can quickly start a spoken or typed interaction without confusion.
- As a user I want to switch between two interlocutors (OWNER and NURSE) using tabs so I can view and continue separate conversations with each persona in the same stage.
- As a clinician using SPEAK mode, I want a single central Voice Mode control that starts/stops STT and controls TTS behavior so device state is explicit and easy to use.

Goals & constraints
- Minimal surface-area changes: preserve existing message model and guardrails, avoid changing server persona redaction/owner RAG logic.
- Keep STT/TTS orchestration and existing auto-pause/resume logic (pause during TTS and when user stops speaking) but remove small per-button mic/speaker/pause icons from the chat chrome.
- Maintain accessibility: both SPEAK and WRITE buttons must be keyboard-focusable and screen-reader friendly. Persona tabs must be navigable by keyboard and announced by assistive technologies.
- Keep the existing Auto-send checkbox (UI/behavior unchanged) and **remove** the small green auto-send triangle micro-icon.

Design decisions & UX
- Replace the current start overlay with two prominent buttons in the composer area: **SPEAK** and **WRITE**.
  - Clicking **SPEAK** enables voice-mode (STT active if microphone permission available) and visually emphasizes the central Voice Mode control.
  - Clicking **WRITE** disables voice-mode and focuses the text input for typed input.
- Add persona tabs (OWNER, NURSE) above the message list. Each tab toggles a filtered view of the messages for that persona; the underlying message store keeps all messages and each message has `personaRoleKey` (existing field) to allow filtering.
  - Messages created while a persona tab is active should be saved with the corresponding `personaRoleKey` value.
  - Switching tabs should not change history; it filters the displayed messages by persona only (owner messages, nurse messages, assistant messages tied to a persona roleKey).
- Central Voice Mode control: a larger, prominent toggle (and Start/Stop states) in the composer area (replace small mic/pause buttons). It must:
  - Toggle `isListening` (STT) and set `ttsEnabled` state appropriately when playing assistant audio.
  - Respect auto-pause rules (TTS auto-pause STT while speaking) but hide the Pause UI visually (logic remains).
  - Provide clear labels: "Voice Mode — On" / "Off" and a secondary visual indicator when actively listening or speaking.
- Remove per-message mic/speaker/pause buttons from the chat chrome (no change to programmatic behavior: TTS and STT still available through the central control and assistant output play behavior).

Data model (TypeScript additions / expectations)
- Reuse existing `Message` interface (in `features/chat/models/chat.ts`) and ensure `personaRoleKey?: string` is set when sending messages while a persona tab is active.
- Local UI state: add `activePersona: "owner" | "veterinary-nurse"` and `personaMessageMap?: Record<string, Message[]>` (optional cache for efficient filtering).
- Persisted behavior: messages continue to be saved via existing attempt/message persistence; when saving new messages, include `personaRoleKey` to enable server-side filtering and analytics.

API contract / integration points
- No server API changes required to support simple persona-specific conversations aside from ensuring `personaRoleKey` is accepted and persisted when sending messages (already supported in `features/chat/services/chatService.ts`).
- UI will rely on the existing persona directory (`/api/personas`) to populate persona tab labels and display avatars.

Acceptance criteria (tests & QA)
- Unit tests:
  - `PersonaTabs` component: verifies tab switching updates `activePersona` and filters messages shown.
  - `VoiceModeControl` component: toggles `isListening` state, starts STT hook when enabled, stops when disabled; respects `ttsEnabled` state when assistant audio is playing.
  - Ensure the Auto-send checkbox remains functional and the micro auto-send triangle is removed from DOM.
- Integration tests (jsdom/node):
  - With `activePersona = "owner"`, submitting a message sets `personaRoleKey = 'owner'` on the outgoing message payload.
  - Toggling to **SPEAK** activates STT and sets focus/visual state correctly; switching to **WRITE** disables STT and focuses the text field.
- E2E (optional):
  - Start the app, switch persona tabs, speak a message with SPEAK enabled and assert messages are sent and appear under the correct persona tab; assert that TTS plays assistant audio and STT resumes automatically after TTS completes.

Accessibility & behavior notes
- Ensure each persona tab has `role="tab"` and appropriate aria-selected and aria-controls attributes, and that the tab list uses `role="tablist"`.
- The SPEAK/WRITE buttons and Voice Mode control must be operable by keyboard (Enter/Space to toggle) and announce state changes to screen readers.

Edge cases & guardrails
- When a message contains a persona change request (e.g., user asks explicitly to talk to the owner), keep existing heuristics from `stage-intent-detector` and DO NOT automatically switch active persona without user confirmation — instead suggest switching using a non-modal in-UI affordance.
- Preserve persona guardrails and redaction: do not expose owner-identifying data when persona role or RAG would block it; server-side guardrails remain authoritative.

Developer notes & implementation plan (small, reviewable commits)
1. Add new UI components:
   - `features/chat/components/PersonaTabs.tsx` (presentational + tests)
   - `features/chat/components/VoiceModeControl.tsx` (presentation+hook wiring + tests)
2. Modify `features/chat/components/chat-interface.tsx`:
   - Replace start overlay with SPEAK/WRITE buttons and integrate `VoiceModeControl` into composer area.
   - Add `activePersona` state and filter the displayed messages by `personaRoleKey`.
   - Remove the small mic/speaker/pause UI (DOM/visual only; keep existing STT/TTS hooks and logic but trigger them from `VoiceModeControl`).
3. Tests:
   - Add unit tests for the new components and update any snapshots as needed.
   - Add integration tests to assert `personaRoleKey` is set on outgoing messages.
4. Run `npm run test`, `npm run lint`, `npm run build`; fix issues.
5. Open PR and request review; leave the sandbox branch deleted with a clear PR referencing the spec.

Acceptance checklist before merge
- [ ] Spec file updated and reviewed.
- [ ] Unit tests for `PersonaTabs` and `VoiceModeControl` pass.
- [ ] Integration tests for persona message assignment pass.
- [ ] Manual test of SPEAK/WRITE flow and TTS/STT auto-pause/resume passes.
- [ ] UX sign-off that the small mic/speaker/pause icons have been removed and the Auto-send checkbox remains.

Implementation notes — timeline & risks
- Estimated small-medium change: 1–2 days of work + tests. The main risk is ensuring no regression in STT/TTS timing/auto-pause behavior; keep tests for the relevant hooks and add mocks to simulate TTS play/resume.

End of Chatbox Voice UI & Persona Tabs micro-spec
