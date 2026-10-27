# Navigation Shell Spec

## User Story

Signed-in users move through VEWAI inside the TailAdmin shell: a collapsible sidebar, a sticky header, and a content column that offsets with the sidebar. Public and full-screen clinical screens stay outside that frame.

## Data Model

```ts
export type ThemeMode = "light" | "dark";

export interface ShellNavItem {
  name: string;
  href: string;
  /** Role gate. Omitted items are visible to every signed-in user. */
  visibleWhen?: "student" | "professor" | "admin";
}

export interface SidebarState {
  isExpanded: boolean;
  isMobileOpen: boolean;
  isHovered: boolean;
  activeItem: string | null;
  openSubmenu: string | null;
}

export interface BreadcrumbItem {
  label: string;
  /** Omitted on the current page. That item renders as text, not a link. */
  href?: string;
}
```

Theme persistence key is `vewai-theme`. When it is unset, the initial mode follows `prefers-color-scheme`. The active mode is the `dark` class on `documentElement`.

## API Contract

No new API routes. The shell reads the current user, role, institution name, and `signOut` from `useAuth()`.

## Component Tree

- `ThemeProvider` — theme state, mounted from `app/layout.tsx`
- `SidebarProvider` — expand, hover, and mobile drawer state
- `AppShell`
  - `AppSidebar` — VEWAI links, VEWAI logos, institution bar
  - `Backdrop` — closes the drawer below the `xl` breakpoint
  - `AppHeader`
    - `ThemeToggleButton`
    - `UserDropdown` — email label and sign out
- `Dropdown` / `DropdownItem` — header menu panel
- `Breadcrumb` — page trail. Items with `href` are links. The last item, without `href`, is the current page.
- `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableCell` — TailAdmin basic table. `TableCell` renders `th` when `isHeader` is true.
- `Select` — TailAdmin select. `options` are `{ value, label }`. `value` and `onChange` are controlled.
- `Alert` — TailAdmin alert. `variant` is `success`, `error`, `warning`, or `info`. Optional `linkHref` / `linkText` render an underline link.
- `DefaultTabs` — TailAdmin tab with badge. Underline tabs in a rounded bordered card. Active tab is `text-brand-500` with a `border-brand-500` underline. `items` are `{ id, label, badge? }`. Optional `badge` is a light brand count next to the label. `value` and `onChange` are controlled. Children render below the tab bar.
- `YearGroupRequiredAlert` — warning shown to students with no year group. Link opens `/select-year-group`.
- `SortHeader` + `useTableSort` — clickable table headers. First click sorts ascending; a second click on the same column flips the direction.

## Critical Rules

- Main menu, in order: Home `/dashboard`, student Dashboard `/student`, professor Dashboard `/professor` (`professor` or `admin`), Start `/case-sessions`, My Attempts `/attempts`.
- A second menu header, Clinical Cases, follows the main menu and is shown only to professors and admins. It contains Cases `/cases` and Case Sessions `/professor/sessions`. Students do not see this header or Available Sessions.
- An Admin menu header follows Clinical Cases and is shown only when `isAdmin` is true. Sub items, in order: Admin Panel `/admin`, Add New Case `/case-entry`, Review and Edit Cases `/case-viewer`, Modify Case Stages `/admin/case-stage-manager`, Nurse Specializations `/admin/nurse-specializations`, Manage Users `/admin/user-management`, Manage Institutions `/admin/institution-management`. LLM Provider Manager and App Specifications Reference stay on the admin page as dialogs and are not sidebar links.
- Dashboard links, including Admin Dashboard, match their path exactly. Every other link is active when the pathname equals `href` or starts with `href + "/"`.
- No shell on `/`, `/login`, `/auth/callback`, `/setup-passkey`, `/case/[id]/attempt`, or `/live/[id]`.
- The shell background (`bg-gray-50`, dark `bg-gray-900`) covers the full page, including content that scrolls past the viewport. The shell does not shrink to the window height.
- Sidebar is expanded by default at `xl` (1280px) and up. Below that it is an off-canvas drawer. Hovering a collapsed desktop sidebar expands it until the pointer leaves.
- Logos are `/images/logo-full.png` (expanded and mobile header) and `/images/logo-v.png` (collapsed). No TailAdmin wordmark, demo notifications, or purchase widget. Directly under the sidebar logo, a full-width `bg-brand-700` bar shows the signed-in user's institution name. The bar is omitted when the user has no institution.
- The header has no search field and no font-size zoom controls.
- `/dashboard`, `/student`, and `/case-sessions` show `YearGroupRequiredAlert` to a student with no year group: they have not selected a year group and must assign themselves to one before they can take any case simulations. The alert link opens `/select-year-group`. Students who already have a year group do not see the alert. `/case-sessions` does not list sessions until a year group is assigned. Nested `/case-sessions/[sessionId]` still redirects unassigned students to `/select-year-group`.
- `/cases` is professor/admin only. It shows `Home` (`/dashboard`) then `Clinical Cases` as the current page. That page has no guided tour. Cases are listed in a basic table (case, species, discipline, difficulty, time). Discipline and species filters use `Select`. Column headers sort the table. Row links open `/case/{id}`. There is no edit-case link.
- `/case/[id]` is the management case page (professor/admin). Breadcrumb is `Home` (`/dashboard`), `Cases` (`/cases`), then the case title. It shows case details including a read-only published checkbox below estimated time, no instructions, latest 3 attempts by anyone (student, session, status, date, time), and latest 3 sessions (session, created by, year, status, starts, ends). Session links in attempts go to `/professor/sessions/{sessionId}`. A Create session control and a View all sessions link open `/professor/sessions/new?caseId=` and `/professor/sessions?caseId=`. Students hitting this URL are sent to `/case/{id}/instructions`.
- `/case/[id]/instructions` is the start/participate case page. Breadcrumb is `Home` (`/dashboard`), `Start` (`/case-sessions`), then the case title. It shows case details, instructions, the current user's latest 3 attempts, and active or scheduled sessions. Attempt rows link to `/attempts/{id}`. Session rows link to `/case-sessions/{sessionId}`. If there are more than 3 own attempts, a link opens `/attempts?caseId=` for that case. Sessions are a table (session, status, starts, ends) with no Start Case button.
- `/case-sessions` shows `Home` (`/dashboard`) then `Start` as the current page. There is no back-to-home link. With `?caseId=` the breadcrumb is `Home`, `Start` (`/case-sessions`), then the case title, and a View case control opens `/case/{id}/instructions`. Session cards open `/case-sessions/[sessionId]`. Students only see sessions for their current year. Unassigned students see `YearGroupRequiredAlert` and no session list. Nested `/case-sessions/` routes still send unassigned students to `/select-year-group`.
- `/case-sessions/[sessionId]` shows `Home` (`/dashboard`), `Start` (`/case-sessions`), then the session friendly name. It is the student session page: Start card with year group, window, and countdown, case card (View Case opens `/case/{id}/instructions`), and the current user's attempts. It does not show professor analytics.
- `/attempts` shows `Home` (`/dashboard`) then `My Attempts` as the current page. Attempts are listed in a basic table (case, status, difficulty, date, time). Every row links to `/attempts/{id}` regardless of status. Filters are case and status. `?caseId=` preselects the case filter. There is no search field. Column headers sort the table. Default order is newest first.
- `/attempts/[id]` shows `Home` (`/dashboard`), `My Attempts` (`/attempts`), then the attempt title as the current page. There is no back-to-attempts link. Two TailAdmin tabs with badge: Conversation then Feedback. The Feedback tab badge is the unread feedback count, and is omitted when there is none. Delete Attempt is shown only to professors and admins. If the attempt is in progress, belongs to the signed-in user, and either has no session or the session has not ended, a Continue Attempt button appears in the main column and opens `/case/{caseId}/attempt?attempt={id}`. If the attempt is in progress and its session has ended, an info card in that same column says the attempt cannot be completed because the session has ended. If the attempt has a session, a session card of the same width sits below Continue Attempt or that info card with the session name, date window, status, and a link to `/case-sessions/{sessionId}`. The professor card is the professor who started that session.
- `/student` is the student dashboard. It does not redirect to `/` or `/dashboard`. Unassigned students see `YearGroupRequiredAlert`. Breadcrumb is `Home` (`/dashboard`) then `Dashboard` as the current page. It shows a profile card (user icon, email, created date, assigned year group), a Start button with icon that opens `/case-sessions`, attempts per month for the last 12 months, and the latest 3 in-progress attempts with a View link to `/attempts/{id}`.
- `/select-year-group` is for students with no year group. It lists that institution's year groups and the academic year-end date. Students who already have a year are sent to `/student`. Professors and admins are sent to `/dashboard`.
- `/professor` shows `Home` (`/dashboard`) then `Dashboard` as the current page. It shows student, case, and active-session counts plus attempts per day for the last 30 days.
- `/professor/sessions` shows `Home` (`/dashboard`) then `Case Sessions` as the current page. Sessions are listed in a basic table (session, case, year, status, starts, ends). Filters are creator (`Created By Me` or `Created By Everyone`, default `Created By Me`, first in the row, brand green), status, case, and year (default All Years). A result count is top right above the table. `?caseId=` preselects the case filter. There is no search field and no dashboard button. Column headers sort the table. Default order is latest start first. Sessions with no year show `—` in the year column and stay visible to staff.
- `/professor/sessions/new` shows `Home` (`/dashboard`), `Case Sessions` (`/professor/sessions`), then `Create Session` as the current page. The page title is `Create Session`. There is no back-to-sessions link.
- `/professor/sessions/[sessionId]` shows `Home` (`/dashboard`), `Case Sessions` (`/professor/sessions`), then the session friendly name as the current page. There is no back-to-all-sessions link. Two TailAdmin tabs with badge: Session Information (session including year group, case, AI group report, attempts-per-day and attempt-status charts) then Attempts with a badge for the attempt count (email column, search by email, status filter, result count top right, standard attempts table).
- `/case-viewer` is admin-only. With no `id` it matches `/cases` (filters, table) except the page title is `Review and Edit Cases`, the subtitle is `Select a case to edit`, and row links open `/case-viewer?id={caseId}`. Breadcrumb is `Home` (`/dashboard`), `Admin` (`/admin`), then `Review and Edit Cases` as the current page. With `?id=` it shows `Home` (`/dashboard`), `Admin` (`/admin`), `Review and Edit Cases` (`/case-viewer`), then the case id as the current page. That editor is full width, loads a single case, and does not browse previous/next cases. The page title is the case title and the subtitle is the case id. The save control is shown only while editing. There is no show-archived control. The case image is at most 300px wide.
- `/admin` is admin-only. Breadcrumb is `Home` (`/dashboard`) then `Admin Panel` as the current page. The page title is `Admin Panel`. There is no help icon and no guided tour. Options are shown as cards, three per row, each with a title and short description.
- `/case-entry` shows `Home` (`/dashboard`), `Admin` (`/admin`), then `Add New Case` as the current page. The page title is `Add New Case`.
- `/admin/user-management` is admin-only. Breadcrumb is `Home` (`/dashboard`), `Admin` (`/admin`), then `User Management` as the current page. The page title is `User Management` with no help icon and no guided tour. Create User is in the top right. Users are listed in a basic table (email, role, institution, year, created, actions). Search filters by email. Role and year filters use `Select`. Year defaults to All Years and includes Unassigned. Column headers sort the table. There is no student-to-professor assignment UI. The create/edit dialog has a year-group select filtered by the user's institution; admins can assign or clear it for students.
- `/admin/institution-management` is admin-only. Breadcrumb is `Home` (`/dashboard`), `Admin` (`/admin`), then `Institution Management` as the current page. The page title is `Institution Management`. Create Institution is in the top right on the list view. Institutions are listed in a basic table (name, created, actions). Column headers sort the table. Manage Institution includes academic year end (day + month, default 31 July) and year-group create/delete, next to Domains and Default roles.
- `/admin/nurse-specializations` is admin-only. Breadcrumb is `Home` (`/dashboard`), `Admin` (`/admin`), then `Nurse Specializations` as the current page. The page title is `Nurse Specializations`. Add Species is in the top right.
- Radix dialog, popover, select, and tooltip overlays sit above the sticky header.
