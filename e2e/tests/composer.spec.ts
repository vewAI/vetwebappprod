import { test, expect } from '@playwright/test';

// Note: these E2E tests assume a running dev server at localhost:3000.
// They are lightweight and primarily assert DOM structure & visual snapshot.

test.describe('Composer header & persona UI', () => {
  test('composer header layout shows persona tabs and voice controls', async ({ page }) => {
    await page.goto('/case-1');

    await expect(page.locator('#persona-tabs')).toBeVisible();
    await expect(page.locator('#voice-mode-control')).toBeVisible();
    await expect(page.locator('#mode-status-button')).toBeVisible();
    await expect(page.locator('#voice-mode-control')).toBeVisible();

    // Visual snapshot for regression
    await page.screenshot({ path: 'e2e-screenshots/composer-header.png', fullPage: false });
  });

  test('mode status button toggles and shows 2s toasts', async ({ page }) => {
    await page.goto('/case-1');
    const mode = page.locator('#mode-status-button');
    await expect(mode).toBeVisible();

    // Click to enable voice mode -> expect SPEAK toast
    await mode.click();
    const speakToast = page.locator('text=SPEAK - Voice Mode Activated');
    await expect(speakToast).toBeVisible();
    await page.waitForTimeout(2200);
    await expect(speakToast).toBeHidden();

    // Click to disable voice mode -> expect WRITE toast
    await mode.click();
    const writeToast = page.locator('text=WRITE - Write Mode Activated');
    await expect(writeToast).toBeVisible();
    await page.waitForTimeout(2200);
    await expect(writeToast).toBeHidden();
  });
});