## Vision
- Introduce hyper-realistic character representations for every interaction, starting with static LLM-generated portraits and evolving toward full lip-synced avatars once the groundwork proves solid.
- Support richer case authoring, assignment, and evaluation workflows so professors can build, deploy, and assess bespoke training scenarios at scale.
- Prepare the platform to host many concurrent users and an expanding library of interactive cases without sacrificing performance or reliability.

## Foundational Platform Upgrades
- Audit the existing data flow (`features/*/services`, `app/api/*`) and design scalable abstractions for multi-case, multi-role usage (consider Prisma or Drizzle with PostgreSQL, Redis for session/queueing, Supabase RLS review).
- Introduce role-based access control (RBAC) layers in Supabase policies and within `AuthProvider` to differentiate students, professors, and admins; document in `features/auth`.
- Plan infrastructure scaling: Vercel/Vite edges for chat + TTS, Supabase pooling, CDN for avatar assets, observability stack (Sentry, Logflare).

## Hyper-Realistic Character Visuals
- Deliver Phase 1 with static portraits:
	- When a case is created/edited, call a generative image service (e.g., OpenAI Images, Stability) to produce high-resolution portraits for each persona defined in `features/role-info`.
	- Persist image metadata/URLs in Supabase (new `case_personas` table) and store assets in Supabase Storage or Vercel Blob; ensure repeatable prompts per role to keep visual continuity.
	- Update client UIs (`ChatInterface`, `Notepad`, progress sidebar, admin case viewer) to display the appropriate portrait alongside dialogue.
- Build a `features/personas` module encapsulating prompt templates, image generation services, cache invalidation, and manual override flows (allow uploading custom imagery).
- Lay the groundwork for future animated avatars by abstracting persona rendering behind a component interface so we can swap static images for real-time avatars later without rewriting chat logic.

## Case Scaling & Content Management
- Rework case schema (`app/api/cases`, `db/create_case_checkpoints.sql`) to support versioning, tags, difficulty levels, and localization; introduce migrations.
- Split `features/case-selection` into data fetching layer and UI to support pagination, search, and recommendation algorithms.
- Implement background workers (Supabase Edge Functions or Vercel Cron) to precompute case insights, maintain checkpoints, and clean stale attempts.

## Admin Case Viewer Enhancements
- Add an auto-complete assistant button in `features/case-selection`/`app/case-viewer` that reads current form state, identifies missing prompts/fields, and fills defaults by calling a new `/api/cases/autocomplete` route.
- Design the backend service to reuse prompt templates from `features/role-info` and `features/stages`, generating consistent copy while marking AI-generated sections for human review.
- Update UI to highlight filled sections, allow one-click revert, and surface provenance metadata.

## Professor Role & Workflows
- Extend Supabase schema with `profiles.role = 'professor'`, join tables for `professor_cases` and `professor_students`.
- Build `features/professors` module containing:
	- authoring tools (case builder UI with draft/publish states, leveraging the new auto-complete service),
	- assignment dashboard (select students, schedule release windows),
	- analytics screens (attempt timelines, feedback summaries, rubric scoring).
- Implement evaluation pipelines: capture rubric inputs, store in dedicated tables, expose instructor feedback to students via `app/attempts/[id]`.

## Next Steps
- Schedule discovery sessions with stakeholders (students, professors) to validate avatar expectations and case authoring flows.
- Produce technical spike documents estimating integration effort for top avatar providers and RBAC changes.
- Prioritize incremental deliverables (e.g., RBAC + professor dashboards first, avatar MVP behind feature flag) and define success metrics.
- Add infra ticket to externalize the OpenAI TTS model (env var + docs) and plan upgrade path to GPT-5 streaming voices once the provider contract is confirmed.
