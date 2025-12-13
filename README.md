This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Populating curated training cases

The UI now expects multiple fully-authored case records in Supabase (case-1, case-2, case-3, ...). A helper script seeds or refreshes those rows so every environment has consistent content adapted from the detailed case-1 template.

1. Ensure the following environment variables are available when you run the script (typically via `.env.local`):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY` (preferred) **or** `NEXT_PUBLIC_SUPABASE_ANON_KEY`
2. Run:

```powershell
npm run seed:cases
```

The script upserts the curated case rows defined in `data/cases/case-seed-data.ts`. Re-run it anytime you tweak case content.
You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Branch workflow

- `main` stays production-ready.
- `dev` only receives code that is fully tested, demo-ready, and safe for others to build upon.
- Any exploratory or in-progress effort lives on `sandbox/*` branches (e.g., `sandbox/2025-12-08-wip`). Create one from `dev`, iterate freely, and push it so the history is backed up.
- When a sandbox change set is stable, cherry-pick or re-implement just that slice onto `dev`, run lint/tests, then push/PR as usual.
- If you want CI or review on a sandbox effort before promoting it, open a PR from the sandbox branch—but do not merge until the work is verified.

This keeps `dev` clean for handoffs while preserving maximum flexibility for ongoing experiments.

## Regression checklist

- Before promoting changes, run `npm run test` and walk through the steps in `docs/regression-checklist.md` (start a fresh attempt, verify the persona roster only contains the owner and veterinary nurse, and ensure stage metadata/guardrails behave as expected).
- Document any deviations in your PR and pause the rollout until they are addressed.

## Avatar Lab sandbox

Need to test the talking avatar without running a full chat? Visit [`/avatar-lab`](http://localhost:3000/avatar-lab) while the dev server is running. The page lets you:

- Pick a case ID + role label (matching the Supabase `case_avatars` table) to verify the correct profile/color loads.
- Enter a mock transcript and synthesize a short sine-wave tone so the analyser sees real amplitude data.
- Fire `vw:tts-start` / `vw:tts-end` events via the UI and inspect the recent event log.

This is especially handy when iterating on new avatar assets or debugging Supabase fallbacks—no need to click through the chat flow.

## Environment variables

The app reads the following public variables at build-time:

| Variable                        | Description                                                                                                                                                    | Default    |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase project URL                                                                                                                                           | _required_ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key                                                                                                                                              | _required_ |
| `NEXT_PUBLIC_AVATAR_ENGINE`     | Controls the avatar system (`classic`, `realistic`, or `disabled`). Use `classic` to keep the existing SVG overlay while we iterate on the new implementation. | `classic`  |

Server-side secrets (place these in `.env.local`, Vercel project settings, etc.):

| Variable                             | Description                                                                                                 | Default |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------- | ------- |
| `SUPABASE_SERVICE_ROLE_KEY`          | Supabase service role key used by API routes for privileged operations                                      | —       |
| `ATTEMPT_PURGE_TOKEN`                | Bearer token required by the attempts purge endpoint (set before wiring up a scheduled job)                 | —       |
| `ATTEMPT_INCOMPLETE_TTL_HOURS`       | Optional override for how many hours to keep incomplete attempts (defaults to 48)                           | `48`    |
| `ATTEMPT_COMPLETED_TTL_MONTHS`       | Optional override for how many months to retain completed attempts before purging (defaults to 6 months)    | `6`     |

### Attempt retention automation

The route `POST /api/attempts/purge` deletes attempt data according to the retention policy (incomplete after 48 hours, completed after 6 months). It accepts an optional `dryRun=1` query parameter to preview counts and requires the `ATTEMPT_PURGE_TOKEN` bearer token when configured. Schedule it with a cron job (e.g., a Vercel Cron entry) hitting either `GET` or `POST`:

```json
{
   "path": "/api/attempts/purge",
   "schedule": "0 4 * * *",
   "httpMethod": "POST",
   "headers": {
      "Authorization": "Bearer ${ATTEMPT_PURGE_TOKEN}"
   }
}
```

Ensure the Supabase Storage bucket `persona-images` exists and is public so portrait assets generated by the chat experience can be served directly to clients.

### Persona portrait backfill

To pre-generate persona imagery without waiting for the chat flow, run:

```bash
npm run generate:portraits
```

Options:

- `--case=case-1` – limit generation to a specific case ID
- `--force` – regenerate portraits even if a `ready` image already exists

The script requires `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, and `OPENAI_API_KEY` in the environment and writes image assets to the `persona-images` bucket.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
