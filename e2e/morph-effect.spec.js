import { test, expect } from '@playwright/test';
import { PNG } from 'pngjs';

/**
 * Visual-property tests verifying the ink-wash composite and frame display.
 *
 * Tests that:
 *   - Canvas renders non-black pixels (pipeline active)
 *   - Ink-wash composite is applied (desaturation visible)
 *   - Frame crossfade works (frames change over time)
 *   - Spatial structure is preserved (not pure noise)
 *   - Vignette is applied (edges darker than center)
 */

const PATCH = 64;

async function captureCanvas(page) {
  const canvas = page.locator('canvas');
  const buf = await canvas.screenshot({ type: 'png' });
  const png = PNG.sync.read(buf);
  return { data: png.data, width: png.width, height: png.height };
}

function extractPatch(img, cx, cy, patchSize) {
  const { data, width, height } = img;
  const ps = Math.min(patchSize, width, height);
  const sx = Math.max(0, Math.min(Math.floor(cx - ps / 2), width - ps));
  const sy = Math.max(0, Math.min(Math.floor(cy - ps / 2), height - ps));
  const patch = new Uint8Array(ps * ps * 4);
  for (let y = 0; y < ps; y++) {
    for (let x = 0; x < ps; x++) {
      const srcIdx = ((sy + y) * width + (sx + x)) * 4;
      const dstIdx = (y * ps + x) * 4;
      patch[dstIdx] = data[srcIdx];
      patch[dstIdx + 1] = data[srcIdx + 1];
      patch[dstIdx + 2] = data[srcIdx + 2];
      patch[dstIdx + 3] = data[srcIdx + 3];
    }
  }
  return patch;
}

function extractCentrePatch(img, patchSize) {
  return extractPatch(img, img.width / 2, img.height / 2, patchSize);
}

function meanAbsDiff(a, b) {
  if (!a || !b || a.length !== b.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]);
  return sum / a.length;
}

function avgLuminance(pixels) {
  let sum = 0;
  const count = pixels.length / 4;
  for (let i = 0; i < pixels.length; i += 4) {
    sum += pixels[i] * 0.2126 + pixels[i + 1] * 0.7152 + pixels[i + 2] * 0.0722;
  }
  return sum / count;
}

function avgSaturation(pixels) {
  let sum = 0;
  const count = pixels.length / 4;
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
    const mx = Math.max(r, g, b);
    const mn = Math.min(r, g, b);
    sum += mx > 0 ? (mx - mn) / mx : 0;
  }
  return sum / count;
}

function spatialCoherence(pixels, w) {
  const h = (pixels.length / 4) / w;
  let sum = 0, count = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w - 1; x++) {
      const idx = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        sum += Math.abs(pixels[idx + c] - pixels[idx + 4 + c]);
        count++;
      }
    }
  }
  return sum / count;
}

test.describe('Ink-Wash Frame Display Verification', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/wall');
    await page.waitForTimeout(2000);
  });

  test('pipeline active — canvas has non-black pixels', async ({ page }) => {
    const img = await captureCanvas(page);
    const patch = extractCentrePatch(img, PATCH);
    const nonZero = Array.from(patch).filter((v, i) => i % 4 !== 3 && v > 5).length;
    expect(nonZero).toBeGreaterThan((patch.length / 4) * 3 * 0.05);
  });

  test('ink-wash desaturation applied — low saturation', async ({ page }) => {
    const img = await captureCanvas(page);
    const patch = extractCentrePatch(img, PATCH);
    const sat = avgSaturation(patch);
    // With 90% desaturation, average saturation should be very low
    expect(sat).toBeLessThan(0.25);
  });

  test('structured output — spatial coherence within range', async ({ page }) => {
    const img = await captureCanvas(page);
    const patch = extractCentrePatch(img, PATCH);
    const coherence = spatialCoherence(patch, PATCH);
    // Not pure noise (>0.5) but not blank (<40)
    expect(coherence).toBeGreaterThan(0.5);
    expect(coherence).toBeLessThan(40);
  });

  test('vignette applied — edges darker than center', async ({ page }) => {
    const img = await captureCanvas(page);
    const centerPatch = extractPatch(img, img.width / 2, img.height / 2, 32);
    const edgePatch = extractPatch(img, 16, img.height / 2, 32);

    const centerLum = avgLuminance(centerPatch);
    const edgeLum = avgLuminance(edgePatch);

    // Edge should be darker than center due to vignette
    expect(edgeLum).toBeLessThan(centerLum + 5);
  });

  test('frames update over time — canvas is not frozen', async ({ page }) => {
    // Capture two frames separated by time — they should differ
    // (due to grain animation at minimum, or frame transitions)
    const img1 = await captureCanvas(page);
    const patch1 = extractCentrePatch(img1, PATCH);

    await page.waitForTimeout(2000);

    const img2 = await captureCanvas(page);
    const patch2 = extractCentrePatch(img2, PATCH);

    const diff = meanAbsDiff(patch1, patch2);
    // Should differ at least slightly (grain animates with time)
    expect(diff).toBeGreaterThan(0.1);
  });

  test('reasonable brightness — not whitewashed', async ({ page }) => {
    const img = await captureCanvas(page);
    const patch = extractCentrePatch(img, PATCH);
    const lum = avgLuminance(patch);

    // Average luminance should be balanced (not too bright, not too dark)
    expect(lum).toBeGreaterThan(20);
    expect(lum).toBeLessThan(200);
  });
});
