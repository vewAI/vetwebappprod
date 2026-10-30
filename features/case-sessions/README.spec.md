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
  createdByName?: string;
  name: string;
  friendlyName: string;
  description: string;
  accessCode: string | null;
  startAt: string;
  endAt: string;
  attemptLimitPerStudent: number | null;
  yearGroupId: string | null;
  yearGroupName?: string | null;
  createdAt: string;
  updatedAt: string;
  case?: {
    id: string;
    title: string;
    species: string;
    difficulty: string;
    imageUrl: string;
    description: string;
    category: string;
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
- **Query**: `caseId?`, `status?` (`scheduled`|`active`|`completed`|`all`), `q?` (search session name / friendly_name / case title), `yearGroupId?` (staff only).
- **Rules**: students are filtered to `year_group_id = their year`. Sessions with a null year are hidden from students and visible to staff. Professors and admins see every year unless `yearGroupId` is set.
- **Response**: `{ sessions: CaseSession[] }` (camelCase in JSON).

### POST /api/case-sessions

- **Auth**: professor or admin.
- **Body**: `{ caseId, name, friendlyName, description?, accessCode?, startAt, endAt, attemptLimitPerStudent?, yearGroupId }` (ISO datetimes).
- **Rules**: `yearGroupId` is required. Professors may only use a year group from their institution; admins may use any. `endAt > startAt`; `endAt > now` (server clock). `startAt` may be now or in the past so a session can be **active** immediately (`datetime-local` is minute precision, so “now” is often a few seconds ago).
- **Response**: `{ session: CaseSession }`.

### GET /api/case-sessions/[sessionId]

- **Auth**: authenticated.
- **Rules**: a student may only load a session whose year group matches theirs. Other years, and sessions with a null year, return 403.
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
- **Rules**: session must be `active` (by time); code must match if set; count of attempts for this user+session < limit if limit set; a student cannot join a session for another year (or a session with no year) even via URL.
- **Response**: `{ attempt: Attempt }` (same shape as existing attempt API / `transformAttempt`).

### GET /api/case-sessions/[sessionId]/attempts

- **Auth**: authenticated.
- **Creator/admin**: all attempts for the session (includes student profile names).
- **Other users**: only their own attempts for that session (no profile join).
- **Response**: `{ attempts: SessionAttemptRow[] }`.

### GET /api/cases/[caseId]/attempts

- **Auth**: professor or admin.
- **Response**: `{ attempts: AttemptSummary[] }` for that case (anyone), including `sessionId`, `sessionName`, `sessionYearGroupId`, `sessionYearGroupName`, and `studentName`. Year group comes from the session, not the student's current assignment.

## Component Tree

- `CreateCaseSessionForm` — case search (`fetchCases`), required year-group select, datetime fields, optional code/limit; submits POST create. Professors see their institution's groups; admins see all, labelled `Institution — Year N` when more than one institution is present.
- `SessionList` — filters (creator, status, case, year). Year defaults to All Year Groups. Creator is first, brand green, and labelled `Created By Me` (default, `mine=true`) or `Created By Everyone`. `initialCaseId` / `?caseId=` preselects the case filter. Basic table rows link to `/professor/sessions/[sessionId]`. Year column shows the year name, or `—` when unset. No search field and no start-attempt action.
- `SessionInfoPanel` — TailAdmin Billing Info card (header, divided label/value rows). Professor variant includes the year group name.
- `JoinSessionDialog` — code input when needed; POST join; `router.push` to attempt URL.
- `SessionsForCaseList` — table of sessions for a case (session, status, starts, ends). `start` shows active and scheduled sessions with row links to `/start/[sessionId]`. `manage` shows every session (session, created by, year, status, starts, ends) with links to `/professor/sessions/[sessionId]`. There is no Start Case action on this table.
- `SessionAttemptsBarChart` / `SessionAttemptStatusPie` — recharts on the professor session page only.
- `StudentSessionDetail` — student Start session page at `/start/[sessionId]`.
  - `StartSessionCard` — year group, window dates, countdown until close, start button
  - `SessionCasePanel` — the same `CaseCard` used on `/attempts/[id]`
  - `MySessionAttemptsList` — attempt limit, remaining count, current user's attempts only
  - While the session is active, an in-progress row links directly to **Continue attempt** using its existing attempt ID. Resuming does not create a new attempt or reduce the remaining allowance. Completed and expired-session rows link to the saved attempt view.

## Critical Rules

- `/start` shows breadcrumb `Home` (`/dashboard`) then `Start`. The page title is `Start`. There is no back-to-home link and no start-case button. It lists active and scheduled sessions in a basic table (session, case, difficulty, status, starts, ends). Filters are case (`All Cases`), status (`All Statuses`, `Active`, `Scheduled`), and difficulty (`All Difficulties`, Easy, Medium, Hard). Completed sessions are not listed. `?caseId=` preselects the case filter and a View case control opens `/start/case/{id}`. Column headers sort the table. Default order is soonest start first. Row links open `/start/[sessionId]`. Students only see sessions for their current year (API-enforced). Unassigned students see `YearGroupRequiredAlert` and no session list.
- `/start/case/[id]` is the start case page (participate). Breadcrumb is `Home` (`/dashboard`), `Start` (`/start`), then the case title. It shows case details, instructions, the current user's latest 3 attempts (session column links to `/start/{sessionId}`; attempt rows open `/attempts/{id}?from=case`), and active or scheduled sessions.
- `/cases/[id]` is the management case dashboard (professor/admin). Breadcrumb is `Home` (`/dashboard`), `Cases` (`/cases`), then the case title. A summary card (image, title, id, time, published) sits above tabs: Case Overview, Sessions, Attempts. Overview uses TailAdmin analytics cards (description, species/category/difficulty, attempts chart, top sessions, top year groups). Sessions lists every session for the case, with year-group (`All Year Groups`), academic year (`Current Academic Year` default, or `Anytime`), and status filters. Current academic year is sessions that start after the institution academic-year cutoff. Attempts lists every attempt with year-group (`All Year Groups`), academic year (`Current Academic Year` default, or `Anytime`), and status filters, plus student search. The Year column is the session's year group, not the student's current year. Current academic year is attempts after that cutoff. Attempt rows open `/attempts/{id}?from=case`.
- `/start/[sessionId]` is the student session page. Breadcrumb is `Home` (`/dashboard`), `Start` (`/start`), then the session friendly name. Title is the session friendly name. The subtitle includes created date and creator. It has a Start card (year group, window, countdown to close, start button), the same case card as `/attempts/[id]` (View Case opens `/start/case/{id}`), and an attempts card (limit, remaining, own attempts; View opens `/attempts/{id}?from=session`). It does not show the AI group report, attempts-per-day chart, or attempt-status chart. Professors manage those on `/professor/sessions/[sessionId]`.
- `/professor/sessions/[sessionId]` has TailAdmin tabs with badge: Session Information then Attempts. The Attempts tab badge is the number of attempts. Session Information has the session panel, case card (View Case opens `/cases/{id}`), AI group report, and the attempts-per-day and attempt-status charts at the bottom. Session, AI group report, and chart cards use the TailAdmin Billing Info header (`text-base font-medium`, padded bar, divider). Attempts shows all session attempts in the standard attempts table (email, status, date, time) with search by email, a status filter, and a result count top right above the table. Attempt rows open `/attempts/{id}?from=session`.
- Client calls use `fetch` + `buildAuthHeaders` + `getAccessToken` (no axios).
- Access code compare: trim, case-insensitive; `null`/empty stored access = open.
- Non-admin users cannot start `/live/[id]` without `?attempt=` or `?session=`; new attempts for students go through POST `.../attempts` only. `/start/case/[id]/attempt` and `/case/[id]/attempt` redirect to `/live/[id]`.
- Admins may still open attempt page without session for dev.
