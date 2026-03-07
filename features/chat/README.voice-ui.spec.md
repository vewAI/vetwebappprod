# Chatbox Voice UI & Persona Tabs — Micro-Spec

User stories
- As a clinician, I want a simple and discoverable chat start control with two prominent choices — **SPEAK** (speech-first) and **WRITE** (text-first) — so I can choose my preferred interaction mode quickly.
- As a clinician, I want to switch between two distinct persona contexts — **OWNER** and **NURSE** — so I can conduct persona-specific conversations that preserve context and follow persona guardrails.

Goals & constraints
- Keep persona guardrails and server-side persona redaction unchanged; this is a UI/UX change and must not alter backend persona sanitization or RAG behavior.
- Implement per-persona conversation views on the client only: messages already include `personaRoleKey` (e.g., `owner` | `veterinary-nurse`) and should be filtered/rendered per-tab.
- Make voice-mode explicit and central: the SPEAK/WRITE controls decide initial mode; a larger Voice Mode toggle controls enabling/disabling STT and TTS devices and visible UI state. Existing auto-pause behavior (pause STT during TTS) should remain but UI pause icon(s) will be removed.
- Remove small mic/speaker icons and the small green auto-send triangle. Keep the **Auto-send** checkbox and its behavior intact.
- Support accessibility (keyboard nav and ARIA labels) for persona tabs and SPEAK/WRITE controls.

Data model (TypeScript interfaces)
- Use existing `Message` interface (`features/chat/models/chat.ts`). Messages include `personaRoleKey?: string`.
- Add client-side `PersonaChatState` shape (no DB change required):

interface PersonaChatState {
  personaKey: "owner" | "veterinary-nurse";
  messages: Message[]; // filtered view derived from global messages
  draft?: string; // unsent text draft specific to persona mode
}

Component tree & responsibilities
- `ChatStartControl` (new): two large buttons — `SPEAK` and `WRITE`.
  - Props: `onSelect(mode: 'speak'|'write')`
  - Behavior: `SPEAK` sets voice mode and arms STT; `WRITE` focuses text input.
- `PersonaTabs` (new): `OWNER` / `NURSE` tabs and optional avatar per tab.
  - Props: `personas: PersonaDirectoryEntry[]`, `active: AllowedChatPersonaKey`, `onSelect(key)`
  - Behavior: switches the active persona; keeps persona-specific draft preserved.
- `ChatView` (existing, refactor): shows messages filtered by `message.personaRoleKey === activePersona` (or fallback rules when missing). Should continue to render message metadata (timestamps, status), and respect guardrails (the transformation/suppression rules remain server/client-side).
- `VoiceModeToggle` (existing state relocated): a central, larger control to enable/disable voice devices and show current state (muted/listening/speaking). This control updates `setVoiceModeEnabled`, `setTtsEnabledState`, and `isListening`/`isPaused` while keeping existing pause/resume orchestration logic.

Behavior & UX rules
- Initial state: show `ChatStartControl` overlay with `SPEAK` and `WRITE` buttons centered in the chat area when there are no user messages in the current persona. Once a persona has messages, hide the start overlay for that persona and show an inline lightweight header (persona avatar + voice-mode state).
- Persona switching: switching tabs updates the visible message list and draft text area. Messages are not moved between persona lists — each message keeps its `personaRoleKey`.
- SPEAK path: selecting `SPEAK` requests microphone permission (if not granted), sets voice mode to enabled, and starts STT if user presses the mic control (or auto-starts if flow is designed to auto-listen). Implementation should prefer explicit user interaction to start listening.
- WRITE path: selecting `WRITE` focuses the text input and disables auto-listening. Typing and pressing Send preserves existing autosend checkbox behavior.
- Auto-pause: during TTS playback, STT should auto-pause (existing logic). The Pause UI control will not be shown, but pause state is maintained internally.

Acceptance criteria (tests)
- Unit tests:
  - `PersonaTabs` selects correct persona and preserves per-persona drafts.
  - `ChatView` filters messages correctly by `personaRoleKey` and handles messages without role keys (fallback to sensible persona)
  - `ChatStartControl` renders `SPEAK` and `WRITE` and triggers mode changes.
  - `VoiceModeToggle` calls STT/TTS enabling/disabling handlers and reflects state.
- Integration tests (component-level):
  - Persona switch keeps separate drafts and message history visible only for the active persona.
  - SPEAK selection attempts to enable STT (mock `useSTT`) and does not send messages until user action or autosend is on.
  - Ensure small mic/speaker icons and small green auto-send triangle are absent from the DOM.
- Manual QA: verify persona guardrail behavior remains (e.g., nurse-sensitive stage suppression still applies and TTS not played for suppressed messages).

Implementation plan (small commits)
1. Add `ChatStartControl` and `PersonaTabs` components with unit tests.
2. Refactor `ChatView` to accept an `activePersona` prop and filter messages accordingly.
3. Add `VoiceModeToggle` placement and adapt existing STT/TTS orchestration to respond to it (no change to internal auto-pause logic).
4. Remove mic/speaker/pause icons and the small green triangle from chat chrome; keep Auto-send checkbox.
5. Add tests and e2e-style integration tests where possible. Run `npm run test` and `npm run dev` to verify dev server and UI.

Developer notes & safety
- Preserve server-side persona redaction and RAG logic; this is strictly client UI work.
- Use `PersonaDirectoryEntry` already present in `chat-interface.tsx` to render persona metadata (avatar/title). Prefer existing avatar fetching logic (e.g., `fetchAvatarProfiles`) to show persona avatars.
- Keep changes incremental and covered by unit tests to prevent regression.

End of Chatbox Voice UI & Persona Tabs micro-spec
