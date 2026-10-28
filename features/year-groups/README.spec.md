# Year Groups Spec

## User Story

As an institution admin, I want year groups and an academic year-end date so students are assigned to a year, sessions are scoped to that year, and students pick again after the year rolls over.

## Data Model

Hand-run SQL: `db/create_year_groups.sql`.

```ts
export interface YearGroup {
  id: string;
  institutionId: string;
  institutionName?: string;
  name: string;
  sortOrder: number;
  createdAt: string;
}
```

- `year_groups`: unique `(institution_id, name)`, cascade delete with the institution.
- `institutions.academic_year_end_month` / `academic_year_end_day`, default 7 / 31 (31 July). Unset values are treated as 31 July.
- `profiles.year_group_id` nullable, `ON DELETE SET NULL`.
- `case_sessions.year_group_id` nullable, `ON DELETE SET NULL`. New creates require a year group.

Students belong to at most one year group. Professors and admins never pick a year.

## API Contract

### GET /api/year-groups

- **Auth**: authenticated.
- **Query**: `institutionId?` (admins only; other roles are scoped to their profile institution).
- **Response**: `{ yearGroups: YearGroup[], academicYearEnd: { month, day } | null }`.

### POST /api/profile/year-group

- **Auth**: student.
- **Body**: `{ yearGroupId }`.
- **Rules**: only when `year_group_id` is currently null; year group must belong to the student's institution.
- **Response**: `{ yearGroupId, yearGroupName }`.

### GET /api/profile

Includes `yearGroupId`, `yearGroupName`, `institutionId`, and `institutionName`.

### GET/POST/DELETE /api/admin/year-groups

- **Auth**: admin.
- **GET** query: `institutionId` required.
- **POST** body: `{ institutionId, name }`.
- **DELETE** query: `id`. Deleting unassigns students and clears session year FKs.

### PATCH /api/admin/institutions

Accepts `academic_year_end_month` and `academic_year_end_day` (1–12 and 1–31) with or without `name`.

### GET/PUT /api/admin/users

Admins may assign or clear `year_group_id`. The year group must belong to the user's institution. Changing institution without a new year group clears the assignment.

### GET/POST /api/cron/academic-year-rollover

- **Auth**: `Authorization: Bearer $CRON_SECRET`. Missing secret returns 503.
- Compares today's **Europe/London** month/day to each institution's year-end (or 31 July).
- Sets `profiles.year_group_id = null` for students of matching institutions.
- Idempotent.
- Schedule: `vercel.json` cron `0 0 * * *` (UTC midnight on Vercel). There is no in-repo scheduler; an external cron can call the same route. Date matching uses London, so UTC midnight still falls on the London calendar date.

## Component Tree

- `InstitutionManagement` — academic year end (day + month, default 31 July) and year groups on Manage Institution, next to Domains / Default roles.
- `InstitutionYearGroups` — create by name, delete (students become unassigned).
- User management — year-group select filtered by the user's institution; Year column; year filter (All Year Groups, Unassigned, or a year group).
- `YearGroupRequiredAlert` — shared TailAdmin warning used on `/dashboard`, `/student`, and `/case-sessions`.
- `/select-year-group` — student picker. Lists that institution's year groups and shows **this academic year ends on {date}**. No submit if the profile has no institution.
- `YearGroupRequiredAlert` — TailAdmin warning on `/dashboard`, `/student`, and `/case-sessions` when a student has no year group. Link opens `/select-year-group`.
- `ProtectedRoute` — if `role === "student"` and `year_group_id` is null, nested `/case-sessions/[sessionId]` redirects to `/select-year-group`. `/student` and `/case-sessions` stay open and show the warning instead. Password change takes precedence. Professors and admins skip the gate. Students who already have a year cannot change it on the picker.

## Critical Rules

- Students self-select only when unassigned. After year-end unassign they pick again. Admins can assign or clear anytime.
- Students without an institution cannot pick a year; an admin must assign an institution first.
- `useAuth()` exposes `yearGroupId`, `yearGroupName`, `institutionId`, and `institutionName`.
- `/dashboard`, `/student`, and `/case-sessions` show `YearGroupRequiredAlert` to students with no year group. `/case-sessions` lists no sessions until a year group is assigned.
