# Conversation Guardrail Regression Checklist

These steps keep Phase 1 guardrails intact whenever you add or modify chat features. Complete them before promoting changes to `dev` or `main`.

## 1. Boot and Seed

1. Run `npm run dev` (or your preferred dev server command).
2. Ensure the Supabase case content is up to date (`npm run seed:cases`) so persona metadata is available.

## 2. Persona Directory Sanity Check

1. Start a brand-new attempt (owner greeting stage).
2. Watch the network panel for `GET /api/personas?caseId=...` and confirm only the `owner` and `veterinary-nurse` role keys are present.
3. Verify the first chat bubble portrays the documented owner (correct portrait + non-technical phrasing).
4. Trigger a nurse response (e.g., request vitals) and confirm the persona card and portrait correspond to the veterinary nurse record.

## 3. Stage Metadata + Auto-Advance

1. Step through the history and physical exam stages.
2. Ensure stage indicators update and the readiness guardrail only fires when completion metrics are missing.
3. Confirm that the nurse persona remains selected when auto-advancing (no fallback to “Veterinarian” or blank portraits).

## 4. Owner Language Guardrail

1. Ask the owner to rephrase the presenting complaint; confirm the reply stays in plain, non-technical wording even when you use clinical terminology in the prompt.
2. Ask the owner for something that is not in the record; verify they decline instead of inventing data.

## 5. Smoke Tests Before Merge

- `npm run test` (unit tests, including persona guardrails)
- Manual chat smoke covering both owner and nurse personas following the above steps.

Record any deviations in the PR description and block the merge until resolved.
