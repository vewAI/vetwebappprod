# Copilot Instructions for AI Coding Agents

## Project Overview

- **Framework:** Next.js 13+ (App Router), TypeScript, Tailwind CSS.
- **Backend:** Supabase (Auth, DB, Storage), OpenAI API.
- **Architecture:** Feature-based modular architecture (`features/`).
- **State Management:** React Hooks, Context (where needed).

## Key Architectural Patterns

- **Feature Modules (`features/*`):**
  - **Self-contained:** Each feature (e.g., `chat`, `auth`, `cases`) owns its domain.
  - **Structure:**
    - `components/`: UI components specific to the feature.
    - `models/`: TypeScript interfaces/types.
    - `services/`: Business logic and API calls (client-side).
    - `hooks/`: Custom React hooks.
    - `utils/`: Helper functions and unit tests (`*.test.ts`).
    - `prompts/`: AI prompts and configurations.
- **App Routing (`app/*`):**
  - **Pages:** `app/[route]/page.tsx`.
  - **API Routes:** `app/api/[route]/route.ts`.
  - **Auth Middleware:** Use `requireUser` from `@/app/api/_lib/auth` in API routes.
- **Service Layer:**
  - **Client-side:** Services in `features/*/services/` use `axios` and `buildAuthHeaders` (from `@/lib/auth-headers`) to communicate with API routes.
  - **Server-side:** API routes orchestrate logic using feature-specific services and utilities.

## Developer Workflows

- **Development:** `npm run dev` (Turbopack enabled).
- **Testing:** `npm run test` (uses `tsx --test` for unit tests).
  - **Location:** Tests are co-located in `utils/` or `__tests__/` within features.
- **Data Seeding:**
  - `npm run seed:cases`: Populate/refresh case data.
  - `npm run generate:portraits`: Generate persona images.
- **Linting:** `npm run lint`.

## Project-Specific Conventions

- **TypeScript:** Strict typing. Prefer interfaces over types for object definitions.
- **File Naming:** Kebab-case for files (`chat-service.ts`), PascalCase for components (`ChatWindow.tsx`).
- **Imports:** Use `@/` alias for root imports.
- **API Communication:**
  - **Client:** Use `axios` with `buildAuthHeaders`. Handle network errors (check `navigator.onLine`).
  - **Server:** Use `NextResponse`.
- **Styling:** Tailwind CSS with `cn` utility (clsx + tailwind-merge) for class composition.

## Domain Logic & Business Rules

- **Speech-to-Text (STT):**
  - Located in `features/speech/services/sttService.ts`.
  - **Rule:** Always check context for homophones and prefer veterinary terminology (e.g., "udder" over "other", "creatinine" over "creating").
  - Use `postProcessTranscript` and `SpeechGrammarList` to enforce this.
- **Time Progression:**
  - Cases evolve through `CaseTimepoint` records.
  - **Rule:** When time progresses, the AI context must be explicitly updated (via `stage_prompt` or system messages) to reflect the new time and patient status.

## Integration Points

- **Supabase:**
  - Client: `lib/supabase.ts`.
  - Auth: `lib/auth-headers.ts` (client), `app/api/_lib/auth.ts` (server).
- **OpenAI:**
  - Configured in API routes using `process.env.OPENAI_API_KEY`.
- **External Resources:**
  - Merck Manual integration in `features/external-resources`.

## Examples

- **Adding a Feature:** Create `features/new-feature/` with `components`, `models`, `services`.
- **API Route:**
  ```typescript
  import { requireUser } from "@/app/api/_lib/auth";
  import { NextResponse } from "next/server";

  export async function POST(req: Request) {
    const user = await requireUser();
    // ... logic
    return NextResponse.json({ success: true });
  }
  ```
- **Client Service:**
  ```typescript
  import { buildAuthHeaders, getAccessToken } from "@/lib/auth-headers";
  import axios from "axios";

  export const myService = {
    doSomething: async () => {
      const token = await getAccessToken();
      const headers = await buildAuthHeaders({}, token);
      return axios.post("/api/my-route", {}, { headers });
    }
  };
  ```
