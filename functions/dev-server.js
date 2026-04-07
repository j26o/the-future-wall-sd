/**
 * Standalone local dev server for testing Cloud Functions logic
 * without Firebase emulators (no Java required).
 *
 * Uses in-memory store instead of Firestore and writes images to disk
 * instead of Firebase Storage.
 *
 * Usage:
 *   cd functions
 *   HF_TOKEN=hf_xxx node dev-server.js          # real HF API
 *   MOCK=1 node dev-server.js                    # mock mode (uses dream images)
 *
 * Endpoints:
 *   POST http://localhost:5001/api/vision   { "text": "..." }
 *   GET  http://localhost:5001/api/visions
 *   GET  http://localhost:5001/api/health
 */

import { createServer } from 'http';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { enrichPrompt } from './services/promptEnricher.js';
import { generateImage } from './services/imageGenerator.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 5001;
const OUTPUT_DIR = join(__dirname, '..', 'public', 'assets', 'generated');
const MOCK = !!process.env.MOCK;

const DREAM_IMAGES = [
  'dream_cloud_forest.jpg', 'dream_coral_reef.jpg', 'dream_crystal_spires.jpg',
  'dream_floating_districts.jpg', 'dream_sky_gardens.jpg', 'dream_solarpunk.jpg',
];

// In-memory vision store
const visions = [];

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); }
      catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function json(res, status, body) {
  cors(res);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

async function handleVision(req, res) {
  const { text } = await parseBody(req);
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return json(res, 400, { error: 'text is required' });
  }

  const transcript = text.trim();
  const id = `vision_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    let prompt;
    let imageUrl;

    if (MOCK) {
      // Mock mode: template prompt + random dream image
      prompt = `[MOCK] Panoramic Singapore waterfront — ${transcript}`;
      const dream = DREAM_IMAGES[Math.floor(Math.random() * DREAM_IMAGES.length)];
      imageUrl = `/assets/dreams/${dream}`;
      console.log(`[vision] MOCK mode: ${imageUrl}`);
      // Simulate network delay
      await new Promise((r) => setTimeout(r, 1500));
    } else {
      console.log(`[vision] Enriching prompt for: "${transcript.slice(0, 60)}..."`);
      prompt = await enrichPrompt(transcript);
      console.log(`[vision] Enriched: "${prompt.slice(0, 80)}..."`);

      // Load base image
      let baseImageBuffer = null;
      try {
        baseImageBuffer = await readFile(join(__dirname, 'assets', 'base-img.png'));
      } catch {
        console.warn('[vision] base-img.png not found — using txt2img');
      }

      console.log('[vision] Generating image...');
      const imageBuffer = await generateImage(prompt, baseImageBuffer);

      // Write to public/assets/generated/
      await mkdir(OUTPUT_DIR, { recursive: true });
      const filename = `${id}.png`;
      const filePath = join(OUTPUT_DIR, filename);
      await writeFile(filePath, imageBuffer);

      imageUrl = `/assets/generated/${filename}`;
      console.log(`[vision] Done: ${imageUrl} (${(imageBuffer.length / 1024).toFixed(0)} KB)`);
    }
    const vision = {
      id,
      transcript,
      prompt,
      imageUrl,
      status: 'complete',
      createdAt: new Date().toISOString(),
    };
    visions.unshift(vision);

    console.log(`[vision] Complete: ${imageUrl}`);
    return json(res, 200, { id, status: 'complete', prompt, imageUrl });
  } catch (err) {
    console.error('[vision] Error:', err.message);
    visions.unshift({
      id, transcript, prompt: '', imageUrl: null,
      status: 'error', error: err.message,
      createdAt: new Date().toISOString(),
    });
    return json(res, 500, { error: err.message });
  }
}

function handleGetVisions(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const limit = Math.min(parseInt(url.searchParams.get('limit'), 10) || 50, 200);
  const completed = visions.filter((v) => v.status === 'complete').slice(0, limit);
  return json(res, 200, completed);
}

function handleHealth(res) {
  return json(res, 200, {
    ok: true,
    timestamp: new Date().toISOString(),
    mode: MOCK ? 'mock' : 'live',
    hfToken: !!process.env.HF_TOKEN,
    visionsCount: visions.length,
  });
}

const server = createServer(async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    cors(res);
    res.writeHead(204);
    return res.end();
  }

  const path = req.url?.split('?')[0];

  if (path === '/api/vision' || path === '/vision') {
    if (req.method !== 'POST') return json(res, 405, { error: 'POST only' });
    return handleVision(req, res);
  }

  if (path === '/api/visions' || path === '/visions') {
    return handleGetVisions(req, res);
  }

  if (path === '/api/health' || path === '/health') {
    return handleHealth(res);
  }

  return json(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`\n  Future Wall SD — Dev API Server`);
  console.log(`  http://localhost:${PORT}/api/health`);
  console.log(`  Mode: ${MOCK ? 'MOCK (dream images, no HF calls)' : 'LIVE'}`);
  console.log(`  HF_TOKEN: ${process.env.HF_TOKEN ? 'set' : 'NOT SET (will use template fallback)'}`);
  console.log(`  Generated images → ${OUTPUT_DIR}\n`);
});
