/**
 * StreamDiffusion-style morph shader.
 *
 * Visual approximation of the StreamDiffusion aesthetic:
 *   Phase 1 (0.0–0.3): Current image gains progressive noise + displacement
 *   Phase 2 (0.3–0.7): Noisy per-pixel blend between current and next
 *   Phase 3 (0.7–1.0): Noise recedes, next image resolves into clarity
 *
 * All tunable parameters are uniforms driven by leva controls.
 */

export const vertexShader = /* glsl */ `
  attribute vec2 a_position;
  varying vec2 v_uv;

  void main() {
    v_uv = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

export const fragmentShader = /* glsl */ `
  precision highp float;

  varying vec2 v_uv;

  uniform sampler2D u_texCurrent;
  uniform sampler2D u_texNext;
  uniform float u_progress;        // 0–1 morph progress
  uniform float u_time;            // elapsed seconds (animated noise)

  // Noise controls
  uniform float u_noiseScale;
  uniform float u_noiseIntensity;
  uniform float u_noiseSpeed;
  uniform float u_grainSize;
  uniform float u_colorBleed;

  // Displacement
  uniform float u_displacementStrength;
  uniform float u_displacementFreq;

  // Blend
  uniform float u_blendStagger;
  uniform float u_midNoise;
  uniform float u_edgeSoftness;

  // Post-processing
  uniform float u_bloomStrength;
  uniform float u_bloomRadius;
  uniform float u_vignette;
  uniform float u_colorTemp;

  // Resolution for aspect-correct noise
  uniform vec2 u_resolution;

  // --- Noise functions ---

  // Hash-based pseudo-random (no texture needed)
  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  // Value noise with smooth interpolation
  float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f); // smoothstep

    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));

    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  // fBm (fractal Brownian motion) — 4 octaves
  float fbm(vec2 p) {
    float value = 0.0;
    float amp = 0.5;
    float freq = 1.0;
    for (int i = 0; i < 4; i++) {
      value += amp * valueNoise(p * freq);
      freq *= 2.0;
      amp *= 0.5;
    }
    return value;
  }

  // Film grain
  float grain(vec2 uv, float time) {
    return hash21(uv * u_grainSize * 500.0 + time * 100.0) - 0.5;
  }

  void main() {
    vec2 uv = v_uv;
    float t = u_progress;

    // --- Phase envelope curves ---
    // Noise envelope: peaks at mid-transition (bell curve)
    float noiseBell = sin(t * 3.14159);
    // Displacement envelope: peaks at 0.3–0.5 progress
    float dispBell = sin(clamp(t * 2.0, 0.0, 3.14159));

    // --- UV displacement (flow distortion) ---
    float noiseT = u_time * u_noiseSpeed;
    vec2 noiseUV = uv * u_displacementFreq * 3.0 + noiseT * 0.3;
    float nx = fbm(noiseUV) - 0.5;
    float ny = fbm(noiseUV + vec2(7.3, 3.7)) - 0.5;
    vec2 displacement = vec2(nx, ny) * u_displacementStrength / u_resolution * dispBell;

    vec2 uvDisplaced = uv + displacement;

    // --- Sample both textures ---
    vec4 colCurrent = texture2D(u_texCurrent, uvDisplaced);
    vec4 colNext = texture2D(u_texNext, uvDisplaced);

    // --- Per-pixel stagger (each pixel transitions at a different time) ---
    vec2 staggerUV = uv * u_noiseScale * 4.0 + noiseT * 0.1;
    float staggerNoise = fbm(staggerUV);
    // Map noise to a per-pixel transition time offset
    float pixelT = clamp((t - staggerNoise * 0.4) / max(u_edgeSoftness, 0.01), 0.0, 1.0);
    pixelT = pow(pixelT, u_blendStagger);

    // --- Blend ---
    vec4 blended = mix(colCurrent, colNext, pixelT);

    // --- Color bleed at morph boundary ---
    float bleedZone = smoothstep(0.3, 0.7, pixelT) * (1.0 - smoothstep(0.3, 0.7, pixelT)) * 4.0;
    vec4 bleedColor = mix(colCurrent, colNext, 0.5);
    blended = mix(blended, bleedColor, bleedZone * u_colorBleed);

    // --- Noise grain overlay (diffusion-like noise) ---
    float grainVal = grain(uv, u_time);
    float noiseOverlay = grainVal * u_noiseIntensity * noiseBell;

    // Mid-transition structural noise (larger scale, looks like partial denoising)
    float midNoise = (fbm(uv * u_noiseScale * 8.0 + noiseT) - 0.5) * u_midNoise * noiseBell;

    blended.rgb += noiseOverlay + midNoise;

    // --- Post-processing ---

    // Bloom: sample at offsets, extract bright parts, blend back
    if (u_bloomStrength > 0.001) {
      vec2 texel = u_bloomRadius * 4.0 / u_resolution;
      // 8-tap radial blur for bloom extraction
      vec3 bloom = vec3(0.0);
      float weights = 0.0;
      for (int i = 0; i < 8; i++) {
        float angle = float(i) * 0.785398; // 2*PI/8
        vec2 off = vec2(cos(angle), sin(angle)) * texel;
        vec4 sC = texture2D(u_texCurrent, uvDisplaced + off);
        vec4 sN = texture2D(u_texNext, uvDisplaced + off);
        vec3 s = mix(sC.rgb, sN.rgb, pixelT);
        float lum = dot(s, vec3(0.2126, 0.7152, 0.0722));
        float bright = max(lum - 0.6, 0.0) * 2.5;
        bloom += s * bright;
        weights += bright;
      }
      if (weights > 0.0) bloom /= weights;
      // Also include current pixel brightness
      float selfLum = dot(blended.rgb, vec3(0.2126, 0.7152, 0.0722));
      float selfBright = max(selfLum - 0.6, 0.0) * 2.5;
      bloom = mix(bloom, blended.rgb, 0.3) * max(selfBright, weights > 0.0 ? 1.0 : 0.0);
      blended.rgb += bloom * u_bloomStrength;
    }

    // Vignette
    float vig = 1.0 - u_vignette * length(uv - 0.5) * 1.4;
    blended.rgb *= vig;

    // Color temperature shift
    blended.r += u_colorTemp * 0.03;
    blended.b -= u_colorTemp * 0.03;

    blended.rgb = clamp(blended.rgb, 0.0, 1.0);
    gl_FragColor = blended;
  }
`;
