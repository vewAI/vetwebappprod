# Copilot Instructions for AI Coding Agents

## Project Overview

- This is a Next.js 13+ app using the `/app` directory structure, TypeScript, and Tailwind CSS.
- Major features are organized in `features/`, each with its own components, models, services, and hooks.
- Supabase is used for backend/auth (see `lib/supabase.ts` and `.env.local` for keys).
- OpenAI API integration is present (see `.env.local`).

## Key Architectural Patterns

- **App Routing:** All pages and API routes are under `app/`. Dynamic routes use `[id]` syntax.
- **Feature Modules:** Each feature (e.g., `attempts`, `auth`, `case-selection`, `chat`) is self-contained with its own subfolders for components, models, services, and hooks.
- **UI Components:** Shared UI elements are in `components/ui/`.
- **Service Layer:** API and business logic are abstracted in `features/*/services/`.
- **Models:** Data types/interfaces are defined in `features/*/models/`.
- **Config:** Project-wide configuration is in `features/config/`.

## Developer Workflows

- **Start Dev Server:** `npm run dev` (or `yarn dev`, etc.)
- **Build:** `npm run build`
- **Lint:** `npm run lint` (uses ESLint config in `eslint.config.mjs`)
- **Tailwind:** Config in `tailwind.config.ts`, styles in `app/globals.css`.
- **Environment Variables:** Set in `.env.local` (Supabase, OpenAI keys).

## Project-Specific Conventions

- **TypeScript:** All code is in TS/TSX. Prefer explicit types and interfaces.
- **File Naming:** Use kebab-case for files, PascalCase for components.
- **Hooks:** Custom hooks live in `features/*/hooks/`.
- **API Routes:** Use Next.js route handlers in `app/api/*/route.ts`.
- **Dynamic Routing:** Use `[id]` folders for dynamic segments.
- **Feedback/Chat:** Feedback and chat features are modular and use their own services/models.

## Integration Points

- **Supabase:** Initialized in `lib/supabase.ts` using env vars.
- **OpenAI:** API key in `.env.local`, used in backend services.
- **External UI:** Tailwind for styling, Geist font via `next/font`.

## Examples

- To add a new feature, create a folder in `features/` with `components/`, `models/`, `services/`, and `hooks/` as needed.
- To add a new API route, create a file in `app/api/[route]/route.ts`.
- To add a new page, create a file in `app/[route]/page.tsx`.

## References

- See `README.md` for basic setup.
- See `features/` for modular feature structure.
- See `app/` for routing and page structure.
- See `.env.local` for required environment variables.

---

If any conventions or workflows are unclear, please ask for clarification or examples from the codebase.
