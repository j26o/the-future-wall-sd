import { test, expect } from '@playwright/test';

test.describe('Input Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/input');
  });

  test('displays title and mic button', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('vision of Singapore');
    const mic = page.locator('button[aria-label*="record"]');
    await expect(mic).toBeVisible();
    await expect(mic).toBeEnabled();
  });

  test('shows status hint text', async ({ page }) => {
    await expect(page.getByText('Press and hold to speak')).toBeVisible();
  });

  test('mic button has correct aria-label when idle', async ({ page }) => {
    const mic = page.locator('button[aria-label="Press and hold to record"]');
    await expect(mic).toBeVisible();
  });

  test('mic button shows SVG microphone icon', async ({ page }) => {
    const svg = page.locator('button[aria-label*="record"] svg');
    await expect(svg).toBeVisible();
  });

  test('no preview image shown in idle state', async ({ page }) => {
    await expect(page.locator('img[alt="Your vision"]')).not.toBeVisible();
  });
});
