/**
 * App configuration — timing, API, leva defaults, asset paths.
 */

export const ASPECT_RATIO = parseFloat(import.meta.env.VITE_ASPECT_RATIO) || 2.33;
export const IMAGE_WIDTH = 1680;
export const IMAGE_HEIGHT = 720;

export const API_BASE = import.meta.env.VITE_API_BASE || '';

/* Morph timing (seconds) */
export const MORPH = {
  IDLE_DURATION: 12,
  VISITOR_DURATION: 8,
  PAUSE_BETWEEN: 2,
};

/* Idle timeout before returning to dream cycling (ms) */
export const IDLE_TIMEOUT_MS = 60_000;

/* Retry config for API calls */
export const RETRY = {
  MAX_ATTEMPTS: 3,
  BASE_DELAY_MS: 1000,
  MAX_DELAY_MS: 8000,
};

/* Dream images for idle cycling */
export const DREAM_IMAGES = [
  '/assets/dreams/dream_cloud_forest.jpg',
  '/assets/dreams/dream_coral_reef.jpg',
  '/assets/dreams/dream_crystal_spires.jpg',
  '/assets/dreams/dream_floating_districts.jpg',
  '/assets/dreams/dream_sky_gardens.jpg',
  '/assets/dreams/dream_solarpunk.jpg',
];

export const BASE_IMAGE = '/assets/textures/base-img.png';

/* Leva default values — StreamDiffusion effect */
export const LEVA_DEFAULTS = {
  morph: {
    idleDuration: MORPH.IDLE_DURATION,
    visitorDuration: MORPH.VISITOR_DURATION,
    pauseBetween: MORPH.PAUSE_BETWEEN,
  },
  noise: {
    scale: 1.0,
    intensity: 0.6,
    speed: 0.5,
    grainSize: 1.5,
    colorBleed: 0.3,
  },
  displacement: {
    strength: 15,
    frequency: 0.8,
  },
  blend: {
    perPixelStagger: 2.5,
    midTransitionNoise: 0.4,
    edgeSoftness: 0.5,
  },
  post: {
    bloomStrength: 0.7,
    bloomRadius: 0.4,
    vignette: 0.3,
    colorTemperature: 0.0,
  },
};

/* Show leva controls panel */
export const SHOW_CONTROLS =
  import.meta.env.VITE_SHOW_CONTROLS === 'true' ||
  new URLSearchParams(window.location.search).has('controls');
