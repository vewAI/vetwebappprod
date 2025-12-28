
This is a refined version of instructions adapted for a Lightweight Spec-Driven Development (SDD) approach.

The core shift here is moving from "Just start coding" to "Define the interface/behavior first, then implement." This reduces hallucinations and ensures the AI understands the full context before writing implementation code.

Copilot Instructions: Lightweight Spec-Driven Development
0. The Prime Directive: Spec First

Never implement code without a defined Spec.
Before writing functional code for a new feature or complex change, generate a Micro-Spec in Markdown.

Draft: Create/Update the spec.md file in the feature directory.

Verify: Ask the user to confirm the logic/data model.

Implement: Write code that strictly adheres to the Spec.

1. Project Overview & Stack

Framework: Next.js 13+ (App Router), TypeScript, Tailwind CSS.

Backend: Supabase (Auth, DB, Storage), OpenAI API.

Architecture: Feature-based modularity with Co-located Specs.

State: React Hooks, Context (minimal global state).

2. The "Micro-Spec" Protocol

Every feature folder (e.g., features/chat/) must contain a README.spec.md.
Format for Specs:

User Story: 1-2 sentences on what this feature achieves.

Data Model: TypeScript interface definitions (The "Source of Truth").

API Contract: Input parameters and Response shapes for API routes.

Component Tree: Bullet points of UI components and their props.

Critical Rules: Domain-specific constraints (e.g., "Must sanitize STT input").

Example Spec Prompt: "Create a spec for the Vitals Log feature including the data model for Heart Rate and Respiratory Rate."

3. Architecture & File Structure
Feature Modules (features/*)

Each feature is a self-contained silo.

[feature-name]/

README.spec.md: (The Blueprint) Contains the logic and models.

models/: TypeScript interfaces (exported from Spec).

components/: UI components.

services/: Client-side business logic & API calls.

hooks/: React hooks.

prompts/: AI system prompts.

__tests__/: Unit tests (validating the Spec).

App Routing (app/*)

Pages: app/[route]/page.tsx (Thin wrappers importing Feature Components).

API: app/api/[route]/route.ts (Orchestrators, not business logic holders).

Middleware: Use requireUser from @/app/api/_lib/auth.

4. Implementation Guidelines
Phase A: Modeling (The Spec)

Define types strictly in models/.

Prefer interface over type.

If a Zod schema is needed for validation, define it alongside the interface.

Phase B: Logic (The Service)

Client Services: Locate in features/*/services/.

Must use buildAuthHeaders and axios.

Must handle navigator.onLine checks.

Server Logic: Keep API routes thin. Delegate complex logic to utility functions or shared server-side services.

Phase C: UI (The Component)

Use Tailwind CSS with cn (clsx + tailwind-merge).

Components should be "dumb" where possible, receiving data via Props defined in the Spec.

5. Domain Logic & Rules (Invariant)
Speech-to-Text (STT)

Spec Rule: STT outputs must be post-processed for veterinary context.

Implementation: Use features/speech/services/sttService.ts.

Enforcement: "Udder" > "Other"; "Creatinine" > "Creating".

Time Progression

Spec Rule: Time is not linear; it is event-based (CaseTimepoint).

Enforcement: Updating time requires explicitly updating the AI context (System Prompt) to match the new CaseTimepoint.

6. Workflows & Commands

1. Spec Generation: User prompts -> AI generates features/xyz/README.spec.md.

2. Development: npm run dev (Turbopack).

3. Validation:

npm run lint: Static analysis.

npm run test: Run unit tests co-located in features.

4. Data Management:

npm run seed:cases: Reset DB state.

7. Code Examples

Spec File (features/auth/README.spec.md):

code
Markdown
download
content_copy
expand_less
# Auth Spec
## Model
interface UserProfile {
  id: string;
  role: 'vet' | 'student';
  last_login: Date;
}
## API
POST /api/auth/login
- Input: { email, password }
- Output: { token: string, user: UserProfile }

Service Implementation:

code
TypeScript
download
content_copy
expand_less
import { buildAuthHeaders } from "@/lib/auth-headers";
import { UserProfile } from "../models"; // Imported from Spec definitions
import axios from "axios";

export const authService = {
  login: async (creds: LoginCredentials): Promise<UserProfile> => {
    // Implementation matching Spec API definition
    const headers = await buildAuthHeaders({});
    const res = await axios.post("/api/auth/login", creds, { headers });
    return res.data.user;
  }
};