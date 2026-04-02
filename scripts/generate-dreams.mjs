#!/usr/bin/env node

/**
 * Pre-generate dream images for idle cycling on the Future Wall.
 *
 * Usage:
 *   HF_TOKEN=hf_xxx node scripts/generate-dreams.mjs
 *
 * Generates images into public/assets/dreams/ using the HF Inference API.
 * Uses the same style guardrails as the production pipeline.
 */

import { InferenceClient } from '@huggingface/inference';
import { writeFile, readFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'public', 'assets', 'dreams');
const BASE_IMG = join(__dirname, '..', 'public', 'assets', 'textures', 'base-img.png');

const HF_TOKEN = process.env.HF_TOKEN;
const MODEL = process.env.HF_IMAGE_MODEL || 'black-forest-labs/FLUX.1-schnell';

if (!HF_TOKEN) {
  console.error('Error: HF_TOKEN environment variable is required.');
  console.error('Usage: HF_TOKEN=hf_xxx node scripts/generate-dreams.mjs');
  process.exit(1);
}

const DREAM_PROMPTS = [
  {
    name: 'dream_sky_gardens',
    prompt:
      'Panoramic watercolour painting of futuristic Singapore waterfront at night, 1680x720. ' +
      'Vast sky gardens with cascading greenery on towering structures, deep navy sky with prismatic aurora, ' +
      'teal supertrees in centre, warm golden light reflections on calm water foreground, fragile linework, ' +
      'pigment bleed textures, calm hopeful atmosphere.',
  },
  {
    name: 'dream_floating_districts',
    prompt:
      'Panoramic watercolour painting of futuristic Singapore waterfront at night, 1680x720. ' +
      'Floating residential districts hovering above the water, connected by luminous bridges, ' +
      'deep navy sky, teal vegetation, golden light trails on water surface, ' +
      'soft atmospheric haze, fragile architectural linework, serene contemplative mood.',
  },
  {
    name: 'dream_coral_reef',
    prompt:
      'Panoramic watercolour painting of futuristic Singapore waterfront at night, 1680x720. ' +
      'Underwater coral reef visible through crystalline water foreground, bioluminescent marine life, ' +
      'supertrees and structures in middle ground, deep navy sky with soft aurora, ' +
      'golden warm light accents, watercolour wash textures, peaceful dreamlike quality.',
  },
  {
    name: 'dream_cloud_forest',
    prompt:
      'Panoramic watercolour painting of futuristic Singapore waterfront at night, 1680x720. ' +
      'Dense cloud forest canopy weaving between modern towers, mist and fireflies, ' +
      'teal-green vegetation, deep blue sky, golden lantern-like lights on water reflections, ' +
      'fragile linework, granulated watercolour texture, nostalgic hopeful mood.',
  },
  {
    name: 'dream_crystal_spires',
    prompt:
      'Panoramic watercolour painting of futuristic Singapore waterfront at night, 1680x720. ' +
      'Crystalline spire towers catching prismatic light, aurora reflections on calm water, ' +
      'supertree silhouettes in centre, deep navy sky fading to indigo, warm golden highlights, ' +
      'soft watercolour bleed, delicate architectural details, contemplative atmosphere.',
  },
  {
    name: 'dream_solarpunk',
    prompt:
      'Panoramic watercolour painting of futuristic Singapore waterfront at night, 1680x720. ' +
      'Solarpunk cityscape with organic solar collectors and vertical farms on buildings, ' +
      'clean energy windmills, lush teal vegetation, deep blue sky with soft colour bands, ' +
      'golden light on water, watercolour wash, fragile linework, optimistic gentle mood.',
  },
];

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const client = new InferenceClient(HF_TOKEN);

  // Try to load base image for img2img
  let baseBlob = null;
  try {
    const buf = await readFile(BASE_IMG);
    baseBlob = new Blob([buf], { type: 'image/png' });
    console.log('Loaded base-img.png for img2img composition control.\n');
  } catch {
    console.warn('base-img.png not found — using txt2img only.\n');
  }

  for (const dream of DREAM_PROMPTS) {
    const outPath = join(OUT_DIR, `${dream.name}.jpg`);
    console.log(`Generating: ${dream.name}...`);

    try {
      let blob;

      if (baseBlob) {
        try {
          blob = await client.imageToImage({
            model: MODEL,
            inputs: baseBlob,
            parameters: {
              prompt: dream.prompt,
              width: 1680,
              height: 720,
            },
          });
        } catch {
          console.warn(`  img2img failed, falling back to txt2img`);
          blob = null;
        }
      }

      if (!blob) {
        blob = await client.textToImage({
          model: MODEL,
          inputs: dream.prompt,
          parameters: {
            width: 1680,
            height: 720,
          },
        });
      }

      const buffer = Buffer.from(await blob.arrayBuffer());
      await writeFile(outPath, buffer);
      console.log(`  Saved: ${outPath} (${(buffer.length / 1024).toFixed(0)} KB)`);
    } catch (err) {
      console.error(`  Error generating ${dream.name}: ${err.message}`);
    }
  }

  console.log('\nDone.');
}

main().catch(console.error);
