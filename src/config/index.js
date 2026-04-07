/**
 * App configuration — timing, API, leva defaults, asset paths.
 */

export const ASPECT_RATIO = parseFloat(import.meta.env.VITE_ASPECT_RATIO) || 2.33;
export const IMAGE_WIDTH = 1680;
export const IMAGE_HEIGHT = 720;

export const API_BASE = import.meta.env.VITE_API_BASE || '';
export const INFERENCE_URL = import.meta.env.VITE_INFERENCE_URL || '/inference';

/* Diffusion transition config */
export const DIFFUSION_TRANSITION = {
  NUM_FRAMES: 8,
  STRENGTH_START: 0.1,
  STRENGTH_END: 0.85,
  FRAME_INTERVAL_MS: 500,   // time between diffusion frames
  CROSSFADE_MS: 200,         // crossfade between consecutive frames
};

/* Morph timing (seconds) — hold = time before switching target */
export const MORPH = {
  IDLE_HOLD: 10,
  VISITOR_HOLD: 6,
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

/* Leva default values — Ink-wash cinematic pipeline + diffusion transitions */
export const LEVA_DEFAULTS = {
  morph: {
    idleHold: MORPH.IDLE_HOLD,
    visitorHold: MORPH.VISITOR_HOLD,
  },
  transition: {
    numFrames: DIFFUSION_TRANSITION.NUM_FRAMES,
    strengthStart: DIFFUSION_TRANSITION.STRENGTH_START,
    strengthEnd: DIFFUSION_TRANSITION.STRENGTH_END,
    frameInterval: DIFFUSION_TRANSITION.FRAME_INTERVAL_MS,
    crossfadeMs: DIFFUSION_TRANSITION.CROSSFADE_MS,
  },
  inkWash: {
    desaturation: 0.90,         // 0=full color, 1=pure grayscale
    inkContrast: 0.6,           // ink-wash contrast boost
    shadowTint: [0.12, 0.08, 0.06],   // warm sepia shadow tint
    highlightTint: [0.06, 0.08, 0.12], // cool blue highlight tint
  },
  fog: {
    fogDensity: 0.18,           // atmospheric fog amount (subtle haze)
    fogBrightness: 0.65,        // fog base brightness (muted, not white)
    fogHeight: 0.5,             // vertical fog gradient
  },
  volumetric: {
    strength: 0.10,             // volumetric light intensity (subtle)
    width: 0.4,                 // width of central light column
    y: 0.3,                     // vertical position of light source (0=bottom, 1=top)
  },
  blur: {
    blurRadius: 1.5,            // gaussian blur radius
  },
  post: {
    halation: 0.06,             // bloom on bright fog only (subtle)
    grainIntensity: 0.06,       // film grain
    vignette: 0.35,             // soft vignette (slightly stronger to frame image)
  },
};

/* Show leva controls panel */
export const SHOW_CONTROLS =
  import.meta.env.VITE_SHOW_CONTROLS === 'true' ||
  new URLSearchParams(window.location.search).has('controls');
