const fs = require("fs");
const { chromium } = require("playwright");
const { createClient } = require("@supabase/supabase-js");

module.exports = async () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";
  const testEmail = process.env.E2E_TEST_EMAIL || "playwright@local";
  const testPassword = process.env.E2E_TEST_PASSWORD || "Test1234!";

  if (supabaseUrl && serviceKey) {
    try {
      const admin = createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false },
      });

      // Create test user (ignore if already exists)
      try {
        await admin.auth.admin.createUser({
          email: testEmail,
          password: testPassword,
          email_confirm: true,
          user_metadata: { role: "student" },
        });
      } catch (e) {
        const msg = e?.message ?? String(e);
        if (!msg.includes("already registered")) {
          console.warn("createUser warning:", msg);
        }
      }
    } catch (err) {
      console.warn("Supabase admin client setup failed, skipping user creation:", err?.message ?? err);
    }
  } else {
    console.warn("Supabase admin credentials not present; skipping test user creation.");
  }

  // Launch a browser to sign in and capture storage state
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto(`${baseURL}/login`);
    await page.fill("#email", testEmail);
    await page.fill("#password", testPassword);
    await page.click('button:has-text("Sign in")');
    // Wait briefly for redirect; tolerant to failures
    await page.waitForTimeout(2500);
  } catch (e) {
    console.warn("Login flow in global-setup failed:", e?.message ?? e);
  }

  const storage = await context.storageState();
  fs.mkdirSync("e2e", { recursive: true });
  fs.writeFileSync("e2e/.auth.json", JSON.stringify(storage, null, 2));

  await browser.close();
};
