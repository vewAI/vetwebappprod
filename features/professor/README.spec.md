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
```

## API Contract

### GET /api/professor/dashboard

- **Auth**: professor or admin.
- **Response**: `ProfessorDashboardStats`.
- **Rules**:
  - `studentCount` is all profiles with role `student` (or null role), counted with the same admin client as user-management.
  - Total Cases View all links to `/cases`. Total Active Sessions View all links to `/professor/sessions`. Total Students Enrolled View all links to `/admin/user-management` for admins.
  - `caseCount` is published cases.
  - `activeSessionCount` is sessions created by the current user whose window includes now.
  - `attemptsByDay` is one point per day for the last 30 days (zeros included) for every attempt in that window. It is not limited to `professor_students` enrollments.
  - `topCases` is the top 5 cases by attempt count in that window. Names are truncated and link to `/case/{id}`. The card button is View All Cases and opens `/cases`.
  - `topSessions` is the 5 most recently created sessions by the current user, newest first. Attempt counts in the list are from the last 30 days. Names are truncated and link to `/professor/sessions/{id}`. The card button is View All Sessions and opens `/case-sessions`.
  - `studentsByYearGroup` is the current student count per year group, including Unassigned. Institution names are prefixed when more than one institution is present.

## Component Tree

- `ProfessorDashboard`
  - `Breadcrumb` — Home `/dashboard`, Dashboard (current)
  - three TailAdmin Card with Icon metric cards (Total Cases, Total Active Sessions, Total Students Enrolled), each with a smaller brand icon left of the title and count, and a View all link
  - TailAdmin Analytics-style Attempts Per Day chart (subtitle Last 30 days)
  - TailAdmin Top Channels cards: Top Cases (subtitle Last 30 days) and Recent Sessions (subtitle Created by you)
  - TailAdmin Sessions By Device donut: Students by year group

## Critical Rules

- `/professor` has no courses list, assigned-cases list, students list, sessions section, pending reviews, or create/browse buttons.
- Page layout matches other list pages: `container mx-auto px-4 pb-8`, centered title.
