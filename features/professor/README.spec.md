# Professor Dashboard Spec

## User Story

As a professor, I want a simple dashboard that shows how many students, cases, and active sessions I have, plus attempt volume over the last month.

## Data Model

```ts
export interface AttemptDayCount {
  date: string; // YYYY-MM-DD
  attempts: number;
}

export interface RankedCount {
  id: string;
  name: string;
  count: number;
}

export interface ProfessorDashboardStats {
  studentCount: number;
  caseCount: number;
  activeSessionCount: number;
  attemptsByDay: AttemptDayCount[];
  topCases: RankedCount[];
  topSessions: RankedCount[];
  studentsByYearGroup: RankedCount[];
}

export interface ProfessorStudentRow {
  userId: string;
  email: string;
  yearGroupId: string | null;
  yearGroupName: string | null;
  createdAt: string;
  lastSignInAt: string | null;
}
```

## API Contract

### GET /api/professor/dashboard

- **Auth**: professor or admin.
- **Response**: `ProfessorDashboardStats`.
- **Rules**:
  - `studentCount` is all profiles with role `student` (or null role), counted with the same admin client as user-management.
  - Total Cases View all links to `/cases`. Total Active Sessions View all links to `/professor/sessions`. Total Students Enrolled View all links to `/professor/students`.
  - `caseCount` is published cases.
  - `activeSessionCount` is sessions created by the current user whose window includes now.
  - `attemptsByDay` is one point per day for the last 30 days (zeros included) for every attempt in that window. It is not limited to `professor_students` enrollments.
  - `topCases` is the top 5 cases by attempt count in that window. Names are truncated and link to `/cases/{id}`. The card button is View All Cases and opens `/cases`.
  - `topSessions` is the 5 most recently created sessions by the current user, newest first. Attempt counts in the list are from the last 30 days. Names are truncated and link to `/professor/sessions/{id}`. The card button is View All Sessions and opens `/start`.
  - `studentsByYearGroup` is the current student count per year group, including Unassigned. Institution names are prefixed when more than one institution is present.

### GET /api/professor/students

- **Auth**: professor or admin.
- **Query**: `page` (1-based, default 1), `pageSize` (default 25, max 100), `email` (optional ilike), `yearGroupId` (`all`, `unassigned`, or a year group id), `sort` (`email` or `joined`, default `email`), `dir` (`asc` or `desc`, default `asc`).
- **Response**: `{ students: ProfessorStudentRow[], total, page, pageSize }`.
- **Rules**: students are profiles with role `student` or null. Professors are scoped to their institution. List rows do not include last sign-in.

### GET /api/professor/students/[id]

- **Auth**: professor or admin.
- **Response**: `ProfessorStudentRow` plus `attempts: AttemptSummary[]`.
- **Rules**: 404 if the profile is not a student, or a professor requests a student outside their institution.

## Component Tree

- `ProfessorDashboard`
  - `Breadcrumb` — Home `/dashboard`, Dashboard (current)
  - three TailAdmin Card with Icon metric cards (Total Cases, Total Active Sessions, Total Students Enrolled), each with a smaller brand icon left of the title and count, and a View all link
  - TailAdmin Analytics-style Attempts Per Day chart (subtitle Last 30 days)
  - TailAdmin Top Channels cards: Top Cases (subtitle Last 30 days) and Recent Sessions (subtitle Created by you)
  - TailAdmin Sessions By Device donut: Students by year group
- `ProfessorStudentsList` — `/professor/students`
- `ProfessorStudentDetail` — `/professor/students/[id]`

## Critical Rules

- `/professor` has no courses list, assigned-cases list, students list, sessions section, pending reviews, or create/browse buttons.
- `/professor/students` lists students with email search (debounced, server) and year-group filter (All Year Groups, Unassigned). The table is server-paged (25 per page) with TailAdmin pagination. Rows open `/professor/students/{userId}`. There is no last-sign-in column.
- `/professor/students/[id]` shows the profile card, Attempts Per Month (last 12 months), and an Attempts card with that student's attempts table. Attempts filters are year group (session year, All Year Groups, Unassigned), case, status, and academic year (`Current Academic Year` or `Anytime`, default current). Attempt rows open `/attempts/{id}?from=student`.
- Page layout matches other list pages: `container mx-auto px-4 pb-8`, centered title.
