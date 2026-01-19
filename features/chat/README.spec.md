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
