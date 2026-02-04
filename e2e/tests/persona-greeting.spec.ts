import { test, expect } from "@playwright/test";

// Test: switching to Nurse via UI should show Nurse greeting but should NOT auto-start STT
test.describe("Persona UI greeting behavior", () => {
  test("Nurse UI greeting does not auto-start mic", async ({ page }) => {
    // Navigate to a case page
    await page.goto("/case/1");

    // Ensure we are on the composer area and voice controls visible
    const speakButton = page.getByRole("button", { name: /speak/i });
    await expect(speakButton).toBeVisible();

    // Ensure mic is idle (not listening) - check for 'Listening' vs 'Idle' state label
    const statusLabel = page.locator("text=Idle").first();
    await expect(statusLabel).toBeVisible();

    // Click the Nurse persona tab/button to switch persona
    // The UI contains a 'NURSE' button in the composer controls
    const nurseButton = page.getByRole("button", { name: /nurse/i });
    await expect(nurseButton).toBeVisible();
    await nurseButton.click();

    // Expect a greeting toast or assistant message to appear saying 'Hello Doc'
    await expect(page.locator("text=Hello Doc")).toBeVisible({ timeout: 5000 });

    // Wait a short time to allow any auto-start to happen if it was going to
    await page.waitForTimeout(1500);

    // Assert mic is still idle (no 'Listening' indicator)
    await expect(page.locator("text=Listening")).toHaveCount(0);
    await expect(page.locator("text=Idle")).toBeVisible();
  });
});
