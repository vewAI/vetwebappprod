# Case Sessions Feature Spec

## User Story

As a professor, I want to create time-bounded sessions for a case (optionally gated by an access code) so students can only start attempts during the session window, attempts are grouped for feedback, and token usage is scoped. As a student, I must join an active session to start a case attempt.

## Data Model

```ts
export type SessionStatus = "scheduled" | "active" | "completed";

export interface CaseSession {
  id: string;
  caseId: string;
  createdBy: string;
  name: string;
  friendlyName: string;
  description: string;
  accessCode: string | null;
  startAt: string;
  endAt: string;
  attemptLimitPerStudent: number | null;
  createdAt: string;
  updatedAt: string;
  case?: {
    id: string;
    title: string;
    species: string;
    difficulty: string;
    imageUrl: string;
  };
}

export interface SessionAttemptRow {
  id: string;
  userId: string;
  caseId: string;
  sessionId: string | null;
  completionStatus: "in_progress" | "completed" | "abandoned";
  createdAt: string;
  completedAt?: string;
  timeSpentSeconds: number;
  studentName?: string;
  studentEmail?: string;
}
```

Status is **never** stored; `deriveStatus({ startAt, endAt }, now)` returns `scheduled` | `active` | `completed`.

## API Contract

### GET /api/case-sessions

- **Auth**: Bearer, any authenticated user.
- **Query**: `caseId?`, `status?` (`scheduled`|`active`|`completed`|`all`), `q?` (search session name / friendly_name / case title).
- **Response**: `{ sessions: CaseSession[] }` (camelCase in JSON).

### POST /api/case-sessions

- **Auth**: professor or admin.
- **Body**: `{ caseId, name, friendlyName, description?, accessCode?, startAt, endAt, attemptLimitPerStudent? }` (ISO datetimes).
- **Rules**: `endAt > startAt`; `startAt >= now` (server clock).
- **Response**: `{ session: CaseSession }`.

### GET /api/case-sessions/[sessionId]

- **Auth**: authenticated.
- **Response**: `{ session: CaseSession }`.

### PATCH /api/case-sessions/[sessionId]

- **Auth**: creator or admin.
- **Body**: partial fields same as create.
- **Response**: `{ session: CaseSession }`.

### DELETE /api/case-sessions/[sessionId]

- **Auth**: creator or admin.
- **Response**: `{ success: true }`.

### POST /api/case-sessions/[sessionId]/attempts

- **Auth**: authenticated (student or professor testing).
- **Body**: `{ accessCode?: string }` if session has code.
- **Rules**: session must be `active` (by time); code must match if set; count of attempts for this user+session < limit if limit set.
- **Response**: `{ attempt: Attempt }` (same shape as existing attempt API / `transformAttempt`).

### GET /api/case-sessions/[sessionId]/attempts

- **Auth**: authenticated.
- **Creator/admin**: all attempts for the session (includes student profile names).
- **Other users**: only their own attempts for that session (no profile join).
- **Response**: `{ attempts: SessionAttemptRow[] }`.

## Component Tree

- `CreateCaseSessionForm` — case search (`fetchCases`), datetime fields, optional code/limit; submits POST create.
- `SessionList` — filters (status, case); rows link to session detail; active rows + `JoinSessionDialog`.
- `JoinSessionDialog` — code input when needed; POST join; `router.push` to attempt URL.
- `SessionsForCaseList` — used on case instructions; lists active/scheduled; completed visible to professor/admin only.
- `SessionAttemptsBarChart` / `SessionAttemptStatusPie` — recharts on session detail page.

## Critical Rules

- Client calls use `fetch` + `buildAuthHeaders` + `getAccessToken` (no axios).
- Access code compare: trim, case-insensitive; `null`/empty stored access = open.
- Non-admin users cannot start `/case/[id]/attempt` without `?attempt=` or `?session=`; new attempts for students go through POST `.../attempts` only.
- Admins may still open attempt page without session for dev.
