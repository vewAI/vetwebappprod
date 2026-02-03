# Routing Refactor TODOs (companion to README.spec.md)

These tasks relate to a small routing refactor to move the top-level dynamic case route under `case/` for clearer URL semantics. Add these to the branch workplan and verify links/tests after the move.

1. Locate existing dynamic `[id]` route
   - Search the codebase for any top-level dynamic route handling `/<id>` (e.g., `app/[id]/` or similar) and record the exact file paths.

2. Analyze link references
   - Find all `href`, `Link`, server-side URL builders, breadcrumbs, tests, and e2e scripts that reference the current `/<id>` route and list files needing updates.

3. Move route to `app/case/[id]`
   - Move page file(s) into `app/case/[id]/`, preserving nested subroutes (e.g., `instructions`, `case-viewer`) as children of the dynamic segment.
   - Ensure Next.js App Router conventions are preserved (layout, loading, metadata files where applicable).

4. Update internal links and imports
   - Update `href`/`Link` usages, breadcrumbs, redirects, and any tests/e2e scripts to point to `/case/[id]`.
   - Optionally add a short-term redirect from `/<id>` to `/case/[id]` (e.g., server-side redirect or middleware) for backward compatibility.

5. Run tests and smoke-check navigation
   - Run unit tests and focused e2e checks that touch routing; start the dev server and spot-check important flows (case list -> case page -> nested instructions) to ensure no regressions.

Notes

- Keep changes small and reviewable: move files in a single commit, then fix references in follow-up commits.
- Update PR description and include a migration note for any external links or bookmarks.

---

This companion file was created because direct editing of `README.spec.md` failed in the patch step. If you want, I can retry updating the original spec in-place or open a PR combining the companion file into the spec.
