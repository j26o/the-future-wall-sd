import { useControls } from 'leva';
import { LEVA_DEFAULTS } from '@/config';

/**
 * Leva controls for the ink-wash composite + diffusion transition pipeline.
 */
export function useLevaControls() {
  const morph = useControls('Morph', {
    idleHold: { value: LEVA_DEFAULTS.morph.idleHold, min: 3, max: 30, step: 0.5, label: 'Idle hold (s)' },
    visitorHold: { value: LEVA_DEFAULTS.morph.visitorHold, min: 2, max: 20, step: 0.5, label: 'Visitor hold (s)' },
  });

  const transition = useControls('Diffusion Transition', {
    numFrames: { value: LEVA_DEFAULTS.transition.numFrames, min: 2, max: 16, step: 1, label: 'Frames' },
    strengthStart: { value: LEVA_DEFAULTS.transition.strengthStart, min: 0.05, max: 0.4, step: 0.05, label: 'Strength start' },
    strengthEnd: { value: LEVA_DEFAULTS.transition.strengthEnd, min: 0.5, max: 0.95, step: 0.05, label: 'Strength end' },
    frameInterval: { value: LEVA_DEFAULTS.transition.frameInterval, min: 200, max: 2000, step: 50, label: 'Frame interval (ms)' },
    crossfadeMs: { value: LEVA_DEFAULTS.transition.crossfadeMs, min: 50, max: 500, step: 25, label: 'Crossfade (ms)' },
  });

  const inkWash = useControls('Ink-Wash Style', {
    desaturation: { value: LEVA_DEFAULTS.inkWash.desaturation, min: 0.0, max: 1.0, step: 0.01, label: 'Desaturation' },
    inkContrast: { value: LEVA_DEFAULTS.inkWash.inkContrast, min: 0.0, max: 1.0, step: 0.05, label: 'Ink contrast' },
  });

  const fog = useControls('Atmosphere / Fog', {
    fogDensity: { value: LEVA_DEFAULTS.fog.fogDensity, min: 0.0, max: 0.8, step: 0.01, label: 'Fog density' },
    fogBrightness: { value: LEVA_DEFAULTS.fog.fogBrightness, min: 0.3, max: 1.0, step: 0.01, label: 'Fog brightness' },
    fogHeight: { value: LEVA_DEFAULTS.fog.fogHeight, min: 0.0, max: 1.0, step: 0.05, label: 'Fog height' },
  });

  const volumetric = useControls('Volumetric Light', {
    strength: { value: LEVA_DEFAULTS.volumetric.strength, min: 0.0, max: 1.0, step: 0.01, label: 'Strength' },
    width: { value: LEVA_DEFAULTS.volumetric.width, min: 0.1, max: 1.0, step: 0.05, label: 'Width' },
    y: { value: LEVA_DEFAULTS.volumetric.y, min: 0.0, max: 1.0, step: 0.05, label: 'Light Y position' },
  });

  const post = useControls('Post-Processing', {
    halation: { value: LEVA_DEFAULTS.post.halation, min: 0.0, max: 1.0, step: 0.01, label: 'Halation' },
    grainIntensity: { value: LEVA_DEFAULTS.post.grainIntensity, min: 0.0, max: 0.2, step: 0.005, label: 'Film grain' },
    vignette: { value: LEVA_DEFAULTS.post.vignette, min: 0.0, max: 1.0, step: 0.01, label: 'Vignette' },
    blurRadius: { value: LEVA_DEFAULTS.blur.blurRadius, min: 0.0, max: 8.0, step: 0.5, label: 'Blur radius' },
  });

  const debug = useControls('Debug', {
    freezeTransitions: { value: false, label: 'Freeze transitions' },
  });

  return {
    morph,
    transition,
    inkWash,
    fog,
    volumetric,
    post,
    debug,
  };
}
