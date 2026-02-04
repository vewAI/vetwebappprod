import { test, expect } from "@playwright/test";

// Note: these E2E tests assume a running dev server at localhost:3000.
// They are lightweight and primarily assert DOM structure & visual snapshot.

test.describe("Composer header & persona UI", () => {
  test("composer header layout shows persona tabs and voice controls", async ({ page }) => {
    await page.goto("/case/1");

    await expect(page.locator("#persona-tabs")).toBeVisible();
    await expect(page.locator("#voice-mode-control")).toBeVisible();
    await expect(page.locator("#mode-status-button")).toBeVisible();
    await expect(page.locator("#voice-mode-control")).toBeVisible();

    // Visual snapshot for regression
    await page.screenshot({ path: "e2e-screenshots/composer-header.png", fullPage: false });
  });

  test("nurse replies with nurse portrait and name when nurse selected", async ({ page }) => {
    await page.goto("/case/1");

    // Ensure nurse tab selected
    await page.locator('[data-testid="persona-nurse"]').click();

    // Send a message as the user
    await page.fill("#chat-input", "hello from student");
    await page.click("#send-button");

    // Wait for the ack & assistant reply
    await page.waitForSelector("text=Let me check that Doc...");

    // The assistant reply should show the nurse's name and portrait alt
    const assistantName = page.locator("text=Martin Lambert");
    await expect(assistantName).toBeVisible();
    const portrait = page.locator('img[alt*="Martin Lambert portrait"]');
    await expect(portrait).toBeVisible();
  });

  test("when nurse is active the nurse acknowledges (NURSE_ACK)", async ({ page }) => {
    await page.goto("/case/1");
    const nurse = page.locator('[data-testid="persona-nurse"]');
    await nurse.click();
    const input = page.locator("#chat-input");
    await input.fill("hello nurse");
    await input.press("Enter");

    // The immediate nurse ack should appear
    const ack = page.locator("text=Let me check that Doc...");
    await expect(ack).toBeVisible();
  });

  test("no extra nurse greeting when already talking to nurse and asking physical exam", async ({ page }) => {
    await page.goto("/case/1");
    // Select nurse tab (this may show a short toast/greeting)
    await page.locator('[data-testid="persona-nurse"]').click();
    // Wait for any toast to fade
    await page.waitForTimeout(2500);

    // Send an initial message as the nurse to simulate active conversation
    await page.fill("#chat-input", "hello nurse");
    await page.press("#chat-input", "Enter");
    // Wait for ack to appear
    await page.waitForSelector("text=Let me check that Doc...");

    // Now ask for the cardiovascular exam which should trigger stage advance
    await page.fill("#chat-input", "please tell me the cardiovascular exam");
    await page.press("#chat-input", "Enter");

    // Wait for nurse reply (find a nurse reply line)
    await page.waitForSelector("text=I'm the veterinary nurse supporting this case", { timeout: 5000 });

    // Ensure 'Hello Doc' assistant greeting was not added again (only at most one instance)
    const helloCount = await page.locator("text=Hello Doc").count();
    expect(helloCount).toBeLessThanOrEqual(1);
  });
});
