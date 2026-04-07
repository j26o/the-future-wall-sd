import { test, expect } from '@playwright/test';
import { PNG } from 'pngjs';
import * as fs from 'fs';
import * as path from 'path';

/**
 * UAT Agent — Ink-Wash Composite Visual Acceptance Test
 *
 * Validates the ink-wash composite post-processing shader renders
 * correctly on displayed frames. Produces a structured report.
 *
 * Run: pnpm test:uat
 *
 * Acceptance criteria:
 *   1. Pipeline active (non-black canvas)
 *   2. Desaturation applied (low saturation)
 *   3. Structured output (spatial coherence)
 *   4. Reasonable brightness (not whitewashed)
 *   5. Vignette applied (edges darker)
 *   6. Temporal variation (grain/frames animate)
 */

const PATCH = 64;
const REPORT_DIR = 'test-results';
const REPORT_FILE = 'uat-streamdiffusion-report.json';

const THRESHOLDS = {
  maxSaturation: 0.25,
  minSpatialCoherence: 0.5,
  maxSpatialCoherence: 40,
  minLuminance: 20,
  maxLuminance: 200,
  minTemporalDiff: 0.1,
  minNonBlackRatio: 0.05,
};

async function captureCanvas(page) {
  const canvas = page.locator('canvas');
  const buf = await canvas.screenshot({ type: 'png' });
  const png = PNG.sync.read(buf);
  return { data: png.data, width: png.width, height: png.height };
}

function extractPatch(img, cx, cy, ps) {
  const { data, width, height } = img;
  const s = Math.min(ps, width, height);
  const sx = Math.max(0, Math.min(Math.floor(cx - s / 2), width - s));
  const sy = Math.max(0, Math.min(Math.floor(cy - s / 2), height - s));
  const patch = new Uint8Array(s * s * 4);
  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      const si = ((sy + y) * width + (sx + x)) * 4;
      const di = (y * s + x) * 4;
      patch[di] = data[si]; patch[di+1] = data[si+1];
      patch[di+2] = data[si+2]; patch[di+3] = data[si+3];
    }
  }
  return patch;
}

function avgLuminance(p) {
  let sum = 0; const n = p.length / 4;
  for (let i = 0; i < p.length; i += 4) sum += p[i]*0.2126 + p[i+1]*0.7152 + p[i+2]*0.0722;
  return sum / n;
}

function avgSaturation(p) {
  let sum = 0; const n = p.length / 4;
  for (let i = 0; i < p.length; i += 4) {
    const mx = Math.max(p[i], p[i+1], p[i+2]);
    const mn = Math.min(p[i], p[i+1], p[i+2]);
    sum += mx > 0 ? (mx - mn) / mx : 0;
  }
  return sum / n;
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

function meanAbsDiff(a, b) {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]);
  return sum / a.length;
}

test.describe('UAT — Ink-Wash Composite Visual Acceptance', () => {
  test('full acceptance suite', async ({ page }) => {
    await page.goto('/wall');
    await page.waitForTimeout(2500);

    const report = {
      timestamp: new Date().toISOString(),
      reference: 'ink-wash composite + local diffusion pipeline',
      thresholds: THRESHOLDS,
      criteria: {},
      overall: 'PASS',
    };

    const img1 = await captureCanvas(page);
    const center1 = extractPatch(img1, img1.width / 2, img1.height / 2, PATCH);

    // ── 1. Pipeline active ──
    {
      const nonZero = Array.from(center1).filter((v, i) => i % 4 !== 3 && v > 5).length;
      const ratio = nonZero / ((center1.length / 4) * 3);
      const pass = ratio > THRESHOLDS.minNonBlackRatio;
      report.criteria.pipelineActive = {
        verdict: pass ? 'PASS' : 'FAIL',
        metric: { nonBlackRatio: +ratio.toFixed(4) },
        threshold: THRESHOLDS.minNonBlackRatio,
        description: 'Canvas renders non-black pixels',
      };
      if (!pass) report.overall = 'FAIL';
    }

    // ── 2. Desaturation ──
    {
      const sat = avgSaturation(center1);
      const pass = sat < THRESHOLDS.maxSaturation;
      report.criteria.desaturation = {
        verdict: pass ? 'PASS' : 'FAIL',
        metric: { avgSaturation: +sat.toFixed(4) },
        threshold: THRESHOLDS.maxSaturation,
        description: 'Ink-wash desaturation applied (low saturation)',
      };
      if (!pass) report.overall = 'FAIL';
    }

    // ── 3. Spatial coherence ──
    {
      const sc = spatialCoherence(center1, PATCH);
      const pass = sc > THRESHOLDS.minSpatialCoherence && sc < THRESHOLDS.maxSpatialCoherence;
      report.criteria.spatialCoherence = {
        verdict: pass ? 'PASS' : 'FAIL',
        metric: { spatialCoherence: +sc.toFixed(4) },
        threshold: { min: THRESHOLDS.minSpatialCoherence, max: THRESHOLDS.maxSpatialCoherence },
        description: 'Output retains spatial structure (not noise or blank)',
      };
      if (!pass) report.overall = 'FAIL';
    }

    // ── 4. Brightness ──
    {
      const lum = avgLuminance(center1);
      const pass = lum > THRESHOLDS.minLuminance && lum < THRESHOLDS.maxLuminance;
      report.criteria.brightness = {
        verdict: pass ? 'PASS' : 'FAIL',
        metric: { avgLuminance: +lum.toFixed(4) },
        threshold: { min: THRESHOLDS.minLuminance, max: THRESHOLDS.maxLuminance },
        description: 'Brightness is balanced (not whitewashed or too dark)',
      };
      if (!pass) report.overall = 'FAIL';
    }

    // ── 5. Vignette ──
    {
      const edgePatch = extractPatch(img1, 16, img1.height / 2, 32);
      const centerSmall = extractPatch(img1, img1.width / 2, img1.height / 2, 32);
      const edgeLum = avgLuminance(edgePatch);
      const centerLum = avgLuminance(centerSmall);
      const pass = edgeLum <= centerLum + 5;
      report.criteria.vignette = {
        verdict: pass ? 'PASS' : 'FAIL',
        metric: { edgeLum: +edgeLum.toFixed(2), centerLum: +centerLum.toFixed(2) },
        description: 'Vignette makes edges darker than or equal to center',
      };
      if (!pass) report.overall = 'FAIL';
    }

    // ── 6. Temporal variation ──
    {
      await page.waitForTimeout(2000);
      const img2 = await captureCanvas(page);
      const center2 = extractPatch(img2, img2.width / 2, img2.height / 2, PATCH);
      const diff = meanAbsDiff(center1, center2);
      const pass = diff > THRESHOLDS.minTemporalDiff;
      report.criteria.temporalVariation = {
        verdict: pass ? 'PASS' : 'FAIL',
        metric: { frameDiff: +diff.toFixed(4) },
        threshold: THRESHOLDS.minTemporalDiff,
        description: 'Canvas updates over time (grain animation or frame transitions)',
      };
      if (!pass) report.overall = 'FAIL';
    }

    // ── Write report ──
    const reportPath = path.join(REPORT_DIR, REPORT_FILE);
    fs.mkdirSync(REPORT_DIR, { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    test.info().attach('UAT Report', {
      body: JSON.stringify(report, null, 2),
      contentType: 'application/json',
    });

    const verdicts = Object.entries(report.criteria)
      .map(([k, v]) => `  ${v.verdict === 'PASS' ? '✓' : '✗'} ${k}`)
      .join('\n');
    console.log(`\n═══ Ink-Wash Composite UAT Report ═══\n${verdicts}\n\n  Overall: ${report.overall}\n`);

    expect(report.overall).toBe('PASS');
  });
});
