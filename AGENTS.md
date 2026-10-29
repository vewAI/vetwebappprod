# VEWAI educator collaboration

These repository instructions apply to Codex work on VEWAI. Keep the shared process in `DEV_CHANGELOG.md` authoritative for all editors, including Antigravity.

1. Work only on `preview/educators`. Before each task, check the branch, `git status`, and the latest commits. Fetch the shared branch and incorporate new commits without overwriting local work. Never push to `main`.
2. Read `DEV_CHANGELOG.md` before editing, including its latest entries. Inspect the relevant `features/*/README.spec.md` and existing tests. Make focused changes that preserve working behaviour and public contracts.
3. Do not remove or alter `DISCLAIMER_SUPPRESSION` in live session prompts. Do not expose or commit credentials, patient/client details, or confidential institutional data.
4. Before committing, run `npx tsc --noEmit` and the relevant `npm test -- features/...` suite. Record actual results and any limitation; never claim an unrun check passed.
5. For every completed task, append the required three-bullet entry to `DEV_CHANGELOG.md`. Include the local date and time (`Europe/London`), the requester (Marco or Ignacio), and the implementation tool (Codex or Antigravity) in the heading. Keep the bullets **Context / Problem**, **Action Taken**, and **Verification**.
6. Commit and push completed changes to `preview/educators` so the next editor can continue from the same state. Before a handoff, report the commit, push status, and anything unfinished. Coordinate before editing the same files in another tool or checkout.
