# LLM Provider Switch — Micro-Spec

## User story
As an admin I want to switch the app's LLM provider (OpenAI, Google Gemini, etc.) from the admin panel and optionally override provider selection per-feature, so we can route workloads to the best API (embeddings, TTS, chat) without major code changes.

## Goals
- Add a safe, auditable way to select default LLM provider and per-feature overrides via admin UI + server config.
- Implement a small provider-adapter layer so code calls a single API surface and the runtime delegates to the selected provider.
- Support fallbacks (try provider A, then B) for specific tasks like embeddings.
- Provide a safe pilot path: start by routing embeddings or TTS to Gemini and validate behavior before broader usage.

## Constraints & Safety
- Secrets for each provider remain in env (e.g., `OPENAI_API_KEY`, `GEMINI_API_KEY`). UI only selects provider names, not keys.
- Fall back and retry policies must avoid silent data loss — return explicit error codes (e.g., `EMBEDDING_MODEL_ACCESS`) so frontend can surface guidance.
- All provider-specific errors must be logged with provider name and model id used.
- Respect existing authorization boundaries (admin-only for provider switching).

## Data models (TypeScript interfaces)
```ts
export type LlmProviderName = "openai" | "gemini" | "none";

export interface LlmProviderConfig {
  defaultProvider: LlmProviderName;
  // optional per-feature override: e.g., { embeddings: 'gemini', tts: 'openai' }
  featureOverrides?: Record<string, LlmProviderName>;
  // optional fallback order for sensitive tasks
  fallbacks?: Record<string, LlmProviderName[]>;
}
```

## API contract (server-side)
- GET `/api/admin/llm-provider` (admin only)
  - Returns current `LlmProviderConfig`.
- POST `/api/admin/llm-provider` (admin only)
  - Body: partial `LlmProviderConfig` to update.
  - Response: updated config.

Server must validate provider names and persist config in DB (new `app_settings` row or `admin_config` table) or in a secure env-backed store.

## Provider Adapter (server-side)
- Path: `lib/llm/providers/*`
- Exposed surface (example):
```ts
// lib/llm/index.ts
export type TaskKind = 'chat' | 'embeddings' | 'tts' | 'edits' | 'completion';
export interface LlmOptions { provider?: LlmProviderName; model?: string; }
export const llm = {
  chat: async (messages, opts?: LlmOptions) => { /* delegates to provider */ },
  embeddings: async (inputs, opts?: LlmOptions) => { /* delegates */ },
  tts: async (text, opts?: LlmOptions) => { /* delegates */ },
}
```

- Provider adapters implement the same small interface:
  - `createChatCompletion(params)`
  - `createEmbeddings(inputs, model?)`
  - `createTts(text, voice?)` (if provider supports TTS)

- Implementations:
  - `lib/llm/providers/openai.ts` — wraps OpenAI SDK calls (existing code can be refactored into it).
  - `lib/llm/providers/gemini.ts` — uses Google's Gemini API client or a thin HTTP wrapper.
  - `lib/llm/providers/index.ts` — selects provider from runtime config + feature override.

## Runtime selection rules
1. Resolve provider by checking:
   - Options passed to call (highest priority)
   - Feature override from persisted config (e.g., `featureOverrides['embeddings']`)
   - Global default `defaultProvider`
2. If provider fails due to model-access or provider-specific recoverable error, consult `fallbacks[feature]` list and retry in order.
3. Return structured error with `code`, `provider`, `attemptedModels` when no provider succeeds.

## Admin UI component
- File: `features/admin/components/LLMProviderManager.tsx`
- Elements:
  - Dropdown: `Default provider` (openai | gemini | none)
  - Table: per-feature override rows (feature name + provider select)
  - Text field: fallback comma-separated lists per-feature
  - Save button: POST to `/api/admin/llm-provider`
  - Validation + confirmation modal before saving

## Pilot strategy (recommendation)
1. Phase 0 — Design/spec (this document).
2. Phase 1 — Implement provider adapter + admin UI storing config (no runtime switch yet). Test DB persistence and security.
3. Phase 2 — Route a single low-risk task to Gemini (e.g., embeddings for new ingestions) behind feature-override. Add detailed logging.
4. Phase 3 — Validate parity (compare embeddings similarity, TTS audio quality, latency). If OK, expand more features.
5. Phase 4 — Optionally make Gemini default for some features or full-swap.

Notes on feasibility:
- Embeddings: Gemini supports embeddings; confirm API (model names and vector format). Implement a mapping layer if Gemini returns different sized vectors.
- TTS: Gemini may offer TTS with different voices/encoding. Implement TTS adapter that returns audio buffer/URL.
- Chat: Gemini call semantics differ; adapter must translate message format and any model-specific params.

## Implementation tasks (developer checklist)
- [ ] Add DB table or `app_settings` key to persist `LlmProviderConfig`.
- [ ] Add admin GET/POST routes with `requireUser` admin checks.
- [ ] Create `lib/llm/providers/openai.ts` (wrap existing calls).
- [ ] Create `lib/llm/providers/gemini.ts` (adapter; minimal functions for embeddings + tts + chat).
- [ ] Create `lib/llm/index.ts` selecting provider and handling fallbacks.
- [ ] Replace direct OpenAI calls where appropriate to use `llm.*` interface (start with ingestion and TTS paths).
- [ ] Add integration tests that mock both providers to validate fallback behavior.

## Metrics & monitoring
- Log provider, model, latency, and errors for each request.
- Add a small admin dashboard showing provider usage, recent failures, and average latency.

## Rollback plan
- Admin UI allows quickly setting `defaultProvider: 'openai'` and clearing overrides.
- Ensure ingestion endpoint can be toggled off (uncheck Process for AI) while debugging.

---

This is a lightweight spec; confirm the feature list and I will scaffold the provider adapter files and admin API endpoints next.
