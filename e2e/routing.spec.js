import { test, expect } from '@playwright/test';

test.describe('Routing', () => {
  test('root redirects to /wall', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/wall/);
  });

  test('/wall page loads', async ({ page }) => {
    await page.goto('/wall');
    await expect(page.locator('canvas')).toBeVisible();
  });

  test('/input page loads with title', async ({ page }) => {
    await page.goto('/input');
    await expect(page.locator('h1')).toContainText('vision of Singapore');
  });

  test('unknown route redirects to /wall', async ({ page }) => {
    await page.goto('/nonexistent');
    await expect(page).toHaveURL(/\/wall/);
  });
});
