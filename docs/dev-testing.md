# Running Tests Locally

Quick notes to run tests locally on Windows PowerShell:

- Install dependencies:
  - npm ci
- Unit tests (Vitest):
  - $env:OPENAI_API_KEY = "test"; $env:SUPABASE_URL = "http://localhost"; $env:SUPABASE_ANON_KEY = "anon"; npm run test:unit
- Run Playwright E2E (requires running dev server or let Playwright start it):
  - npm run playwright:install
  - npm run test:e2e

Tips:
- If Playwright's dev server fails to start because another process is using port 3000, stop the conflicting process or set a different port.
- Unit tests are mocked to avoid calling real OpenAI/Supabase services by default via `test/setupTests.ts`.
