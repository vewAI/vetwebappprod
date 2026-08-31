## Summary
- Brings the full Live sessions evolution (merge/live-integration lineage) into main: persistence, security hardening, resume continuity, UX fixes
- Integrates main's strapline copy changes (Nick Coleman, PR #16) — single conflict in app/page.tsx resolved favoring the student-only conditional
- Includes recent fix waves F1-F5: feedback pipeline repair, XSS sanitization, ephemeral Gemini tokens, Redis rate limiting, atomic session claim, autosave upsert, intent auto-advance, test results panel, live captions + interrupt

## Verification
- tsc clean, 123/123 vitest passing
- Manual QA on Vercel previews: session flow, resume, feedback, test results panel, translations

## Required before/after merge
- Supabase migrations must be applied to the production DB: `db/add_live_hot_path_indexes.sql`, `db/add_claim_live_attempt.sql`
- Env vars in production: `GEMINI_API_KEY`, `OPENAI_API_KEY`; optional `REDIS_URL` (authoritative rate limiting), `LIVE_REQUIRE_EPHEMERAL_TOKENS=1` only once ephemeral token issuance is fixed (currently falls back to raw key if set to 0)
