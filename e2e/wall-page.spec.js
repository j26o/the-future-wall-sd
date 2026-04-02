import { test, expect } from '@playwright/test';

test.describe('Wall Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/wall');
  });

  test('renders WebGL canvas', async ({ page }) => {
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();
    await expect(canvas).toHaveCount(1);
  });

  test('canvas has non-zero dimensions', async ({ page }) => {
    const canvas = page.locator('canvas');
    const box = await canvas.boundingBox();
    expect(box.width).toBeGreaterThan(0);
    expect(box.height).toBeGreaterThan(0);
  });

  test('leva panel is hidden by default', async ({ page }) => {
    // Leva root should not be visible (no ?controls=true)
    const levaPanel = page.locator('[class*="leva-"] input');
    await expect(levaPanel.first()).not.toBeVisible();
  });

  test('leva panel shows with ?controls=true', async ({ page }) => {
    await page.goto('/wall?controls=true');
    // Wait for leva to render its panel
    const levaFolder = page.locator('[class*="leva-"]');
    await expect(levaFolder.first()).toBeVisible();
  });

  test('canvas renders pixels (WebGL context active)', async ({ page }) => {
    // Wait a frame for the shader to render
    await page.waitForTimeout(500);
    const hasPixels = await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return false;
      const gl = canvas.getContext('webgl', { preserveDrawingBuffer: true });
      if (!gl) return false;
      const pixels = new Uint8Array(4);
      gl.readPixels(
        Math.floor(canvas.width / 2),
        Math.floor(canvas.height / 2),
        1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels,
      );
      // At least some non-zero pixel data
      return pixels[3] > 0;
    });
    expect(hasPixels).toBe(true);
  });
});
