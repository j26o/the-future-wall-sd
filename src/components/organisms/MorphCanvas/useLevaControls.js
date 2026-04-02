import { useControls, folder, button } from 'leva';
import { LEVA_DEFAULTS } from '@/config';

/**
 * Leva controls for all StreamDiffusion effect parameters.
 * Returns a flat object of values to pass as shader uniforms.
 */
export function useLevaControls() {
  const morph = useControls('Morph', {
    idleDuration: { value: LEVA_DEFAULTS.morph.idleDuration, min: 4, max: 30, step: 0.5 },
    visitorDuration: { value: LEVA_DEFAULTS.morph.visitorDuration, min: 2, max: 20, step: 0.5 },
    pauseBetween: { value: LEVA_DEFAULTS.morph.pauseBetween, min: 0, max: 8, step: 0.5 },
  });

  const noise = useControls('Noise', {
    scale: { value: LEVA_DEFAULTS.noise.scale, min: 0.1, max: 5.0, step: 0.1 },
    intensity: { value: LEVA_DEFAULTS.noise.intensity, min: 0.0, max: 1.0, step: 0.01 },
    speed: { value: LEVA_DEFAULTS.noise.speed, min: 0.0, max: 3.0, step: 0.05 },
    grainSize: { value: LEVA_DEFAULTS.noise.grainSize, min: 0.5, max: 5.0, step: 0.1 },
    colorBleed: { value: LEVA_DEFAULTS.noise.colorBleed, min: 0.0, max: 1.0, step: 0.01 },
  });

  const displacement = useControls('Displacement', {
    strength: { value: LEVA_DEFAULTS.displacement.strength, min: 0, max: 80, step: 1 },
    frequency: { value: LEVA_DEFAULTS.displacement.frequency, min: 0.1, max: 5.0, step: 0.1 },
  });

  const blend = useControls('Blend', {
    perPixelStagger: { value: LEVA_DEFAULTS.blend.perPixelStagger, min: 0.5, max: 6.0, step: 0.1 },
    midTransitionNoise: { value: LEVA_DEFAULTS.blend.midTransitionNoise, min: 0.0, max: 1.0, step: 0.01 },
    edgeSoftness: { value: LEVA_DEFAULTS.blend.edgeSoftness, min: 0.05, max: 1.0, step: 0.01 },
  });

  const post = useControls('Post-Processing', {
    bloomStrength: { value: LEVA_DEFAULTS.post.bloomStrength, min: 0.0, max: 2.0, step: 0.01 },
    bloomRadius: { value: LEVA_DEFAULTS.post.bloomRadius, min: 0.1, max: 2.0, step: 0.05 },
    vignette: { value: LEVA_DEFAULTS.post.vignette, min: 0.0, max: 1.0, step: 0.01 },
    colorTemperature: { value: LEVA_DEFAULTS.post.colorTemperature, min: -1.0, max: 1.0, step: 0.01 },
  });

  const debug = useControls('Debug', {
    freezeProgress: false,
    manualProgress: { value: 0.5, min: 0.0, max: 1.0, step: 0.001 },
  });

  return {
    morph,
    noise,
    displacement,
    blend,
    post,
    debug,
  };
}
