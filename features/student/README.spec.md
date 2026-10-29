# Student Dashboard Spec

## User Story

As a student, I want a dashboard that shows who I am, how much I have practised each month, my latest in-progress attempts, and a way to start a case.

## Data Model

```ts
export interface AttemptMonthCount {
  month: string; // YYYY-MM
  label: string;
  attempts: number;
}
```

Attempts are loaded with `getUserAttempts()`. The profile card uses the signed-in user's email, `created_at`, and assigned year group name from `useAuth()`.

## Component Tree

- `StudentDashboard`
  - `Breadcrumb` — Home `/dashboard`, Dashboard (current)
  - `YearGroupRequiredAlert` — shown when no year group is assigned
  - profile card — user icon, email, created date, assigned year group
  - Start button — icon plus Start, opens `/start`
  - `AttemptsPerMonthChart` — last 12 months, zeros included
  - Active Attempts table — latest 3 in-progress attempts, View opens `/attempts/{id}`

## Critical Rules

- `/student` is a student dashboard. It does not redirect to `/` or `/dashboard`. Students with no year group see `YearGroupRequiredAlert`.
- Only students can view the page. Other roles see access denied.
- Page layout matches other list pages: `container mx-auto px-4 pb-8`, centered title.
- Card headers are title case and brand green (`text-primary`).
- Active Attempts shows at most 3 in-progress attempts, newest first. A View all control opens `/attempts`.
