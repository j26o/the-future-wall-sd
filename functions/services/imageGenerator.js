import { InferenceClient } from '@huggingface/inference';
import { HF_TOKEN, HF_IMAGE_MODEL, IMAGE_WIDTH, IMAGE_HEIGHT } from '../config.js';

/**
 * Generate an image from a prompt using the HF Inference API.
 *
 * Returns a Buffer containing the PNG image data.
 *
 * Attempts img2img with base image first; falls back to txt2img.
 */
export async function generateImage(prompt, baseImageBuffer = null) {
  if (!HF_TOKEN) {
    throw new Error('HF_TOKEN is required for image generation');
  }

  const client = new InferenceClient(HF_TOKEN);

  // Try img2img if base image is provided
  if (baseImageBuffer) {
    try {
      const blob = await client.imageToImage({
        model: HF_IMAGE_MODEL,
        inputs: new Blob([baseImageBuffer], { type: 'image/png' }),
        parameters: {
          prompt,
          width: IMAGE_WIDTH,
          height: IMAGE_HEIGHT,
        },
      });
      return Buffer.from(await blob.arrayBuffer());
    } catch (err) {
      console.warn('[imageGenerator] img2img failed, falling back to txt2img:', err.message);
    }
  }

  // Fallback: txt2img
  const blob = await client.textToImage({
    model: HF_IMAGE_MODEL,
    inputs: prompt,
    parameters: {
      width: IMAGE_WIDTH,
      height: IMAGE_HEIGHT,
    },
  });

  return Buffer.from(await blob.arrayBuffer());
}
