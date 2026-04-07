/**
 * Client for the local diffusion inference server.
 * Handles image generation and interpolation transitions.
 */

import { INFERENCE_URL } from '@/config';

async function post(endpoint, body) {
  const res = await fetch(`${INFERENCE_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Inference server error ${res.status}: ${text}`);
  }
  return res.json();
}

/**
 * Check if the inference server is available.
 * @returns {Promise<{ok: boolean, model: string, device: string}>}
 */
export async function checkHealth() {
  try {
    const res = await fetch(`${INFERENCE_URL}/health`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return { ok: false };
    return res.json();
  } catch {
    return { ok: false };
  }
}

/**
 * Generate an image from a text prompt (txt2img).
 * @param {string} prompt
 * @param {{width?: number, height?: number, steps?: number, seed?: number}} opts
 * @returns {Promise<{image_url: string, elapsed_ms: number}>}
 */
export async function generateImage(prompt, opts = {}) {
  return post('/generate', { prompt, ...opts });
}

/**
 * Generate an image from an init image + prompt (img2img).
 * @param {string} image — base64, data URI, or path
 * @param {string} prompt
 * @param {number} strength — denoising strength (0-1)
 * @param {{width?: number, height?: number, steps?: number, seed?: number}} opts
 * @returns {Promise<{image_url: string, elapsed_ms: number}>}
 */
export async function img2img(image, prompt, strength, opts = {}) {
  return post('/img2img', { image, prompt, strength, ...opts });
}

/**
 * Generate interpolation frames between two images via chained img2img.
 * @param {string} imageA — source image (base64, data URI, or path)
 * @param {string} promptB — target prompt
 * @param {{imageB?: string, numFrames?: number, strengthStart?: number, strengthEnd?: number, steps?: number, seed?: number}} opts
 * @returns {Promise<{frames: string[], num_frames: number, elapsed_ms: number, avg_frame_ms: number}>}
 */
export async function interpolate(imageA, promptB, opts = {}) {
  return post('/interpolate', {
    image_a: imageA,
    prompt_b: promptB,
    image_b: opts.imageB,
    num_frames: opts.numFrames,
    strength_start: opts.strengthStart,
    strength_end: opts.strengthEnd,
    width: opts.width,
    height: opts.height,
    steps: opts.steps,
    seed: opts.seed,
  });
}
