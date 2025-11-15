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

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
