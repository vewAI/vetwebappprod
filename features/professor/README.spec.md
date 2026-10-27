# Professor Dashboard Spec

## User Story

As a professor, I want a simple dashboard that shows how many students, cases, and active sessions I have, plus attempt volume over the last month.

## Data Model

```ts
export interface AttemptDayCount {
  date: string; // YYYY-MM-DD
  attempts: number;
}

export interface ProfessorDashboardStats {
  studentCount: number;
  caseCount: number;
  activeSessionCount: number;
  attemptsByDay: AttemptDayCount[];
}
```

## API Contract

### GET /api/professor/dashboard

- **Auth**: professor or admin.
- **Response**: `ProfessorDashboardStats`.
- **Rules**:
  - `studentCount` is all profiles with role `student` (or null role), counted with the same admin client as user-management.
  - Total cases card links to `/cases`. Active sessions card links to `/professor/sessions`.
  - `caseCount` is published cases.
  - `activeSessionCount` is sessions created by the current user whose window includes now.
  - `attemptsByDay` is one point per day for the last 30 days (zeros included) for attempts by those enrolled students.

## Component Tree

- `ProfessorDashboard`
  - `Breadcrumb` — Home `/dashboard`, Dashboard (current)
  - three summary cards
  - `AttemptsPerDayChart`

## Critical Rules

- `/professor` has no courses list, assigned-cases list, students list, sessions section, pending reviews, analytics cards, or create/browse buttons.
- Page layout matches other list pages: `container mx-auto px-4 pb-8`, centered title.
