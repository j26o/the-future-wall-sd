import { test, expect } from '@playwright/test';

test.describe('Design Tokens & Styling', () => {
  test('body uses deep background color', async ({ page }) => {
    await page.goto('/wall');
    const bg = await page.evaluate(() =>
      getComputedStyle(document.body).backgroundColor,
    );
    // --color-bg-deep: #050810 → rgb(5, 8, 16)
    expect(bg).toBe('rgb(5, 8, 16)');
  });

  test('body has no overflow (scrollbars hidden)', async ({ page }) => {
    await page.goto('/wall');
    const overflow = await page.evaluate(() =>
      getComputedStyle(document.body).overflow,
    );
    expect(overflow).toBe('hidden');
  });

  test('input page title uses text color token', async ({ page }) => {
    await page.goto('/input');
    const color = await page.evaluate(() => {
      const h1 = document.querySelector('h1');
      return getComputedStyle(h1).color;
    });
    // --color-text: #e8e4dc → rgb(232, 228, 220)
    expect(color).toBe('rgb(232, 228, 220)');
  });

  test('html and body fill viewport', async ({ page }) => {
    await page.goto('/wall');
    const dims = await page.evaluate(() => {
      const html = document.documentElement;
      const body = document.body;
      return {
        htmlW: getComputedStyle(html).width,
        htmlH: getComputedStyle(html).height,
        bodyW: getComputedStyle(body).width,
        bodyH: getComputedStyle(body).height,
      };
    });
    // Both should be non-zero viewport-filling values
    expect(parseInt(dims.htmlW)).toBeGreaterThan(0);
    expect(parseInt(dims.htmlH)).toBeGreaterThan(0);
    expect(dims.htmlW).toBe(dims.bodyW);
    expect(dims.htmlH).toBe(dims.bodyH);
  });
});
