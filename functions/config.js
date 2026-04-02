/**
 * Server-side configuration. Reads from environment variables
 * set via `firebase functions:config:set` or `.env` in functions/.
 */

export const HF_TOKEN = process.env.HF_TOKEN || '';
export const HF_IMAGE_MODEL = process.env.HF_IMAGE_MODEL || 'black-forest-labs/FLUX.1-schnell';
export const HF_LLM_MODEL = process.env.HF_LLM_MODEL || 'mistralai/Mistral-7B-Instruct-v0.3';
export const HF_LLM_PROVIDER = process.env.HF_LLM_PROVIDER || undefined;

export const IMAGE_WIDTH = parseInt(process.env.IMAGE_WIDTH, 10) || 1680;
export const IMAGE_HEIGHT = parseInt(process.env.IMAGE_HEIGHT, 10) || 720;
export const IMAGE_STRENGTH = parseFloat(process.env.IMAGE_STRENGTH) || 0.4;
