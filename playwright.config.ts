import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e/tests",
  timeout: 30_000,
  expect: { timeout: 5000 },
  fullyParallel: false,
  reporter: "list",
  globalSetup: "e2e/global-setup.js",
  use: {
    headless: true,
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    storageState: "e2e/.auth.json",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
