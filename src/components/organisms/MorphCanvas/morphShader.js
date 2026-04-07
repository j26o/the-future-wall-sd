/**
 * Ink-wash cinematic composite shader.
 *
 * Diffusion frames from the local inference server are displayed through
 * this post-processing pipeline for consistent visual style.
 *
 * Pass 1 — Blur H: Horizontal gaussian (halation source).
 * Pass 2 — Blur V: Vertical gaussian.
 * Pass 3 — Composite: Crossfade between frames, ink-wash desaturation,
 *                      depth fog, volumetric light columns, halation,
 *                      film grain, filmic contrast rolloff, vignette.
 */

export const vertexShader = /* glsl */ `
  attribute vec2 a_position;
  varying vec2 v_uv;
  void main() {
    v_uv = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

// ── Pass 1 & 2: Separable Gaussian blur ─────────────────────────────

export const blurFragment = /* glsl */ `
  precision highp float;

  varying vec2 v_uv;
  uniform sampler2D u_tex;
  uniform vec2 u_direction;
  uniform float u_blurRadius;
  uniform vec2 u_resolution;

  void main() {
    vec2 texel = u_direction * u_blurRadius / u_resolution;

    vec4 sum  = texture2D(u_tex, v_uv) * 0.2270270270;
    sum += texture2D(u_tex, v_uv + texel * 1.3846153846) * 0.3162162162;
    sum += texture2D(u_tex, v_uv - texel * 1.3846153846) * 0.3162162162;
    sum += texture2D(u_tex, v_uv + texel * 3.2307692308) * 0.0702702703;
    sum += texture2D(u_tex, v_uv - texel * 3.2307692308) * 0.0702702703;

    gl_FragColor = sum;
  }
`;

// ── Pass 3: Cinematic composite (crossfade + ink-wash + fog + volumetrics) ──

export const compositeFragment = /* glsl */ `
  precision highp float;

  varying vec2 v_uv;

  // Frame textures
  uniform sampler2D u_texCurrent;     // Current diffusion frame
  uniform sampler2D u_texPrev;        // Previous frame (for crossfade)
  uniform sampler2D u_texBlurred;     // Blurred version (halation source)
  uniform float u_crossfade;          // 0=prev, 1=current
  uniform float u_time;

  // Ink-wash style
  uniform float u_desaturation;
  uniform float u_inkContrast;
  uniform vec3  u_shadowTint;
  uniform vec3  u_highlightTint;

  // Atmospheric depth fog
  uniform float u_fogDensity;
  uniform float u_fogBrightness;
  uniform float u_fogHeight;

  // Volumetric light
  uniform float u_volumetricStrength;
  uniform float u_volumetricWidth;
  uniform float u_volumetricY;

  // Halation (bloom on bright fog only)
  uniform float u_halation;

  // Film grain
  uniform float u_grainIntensity;

  // Vignette
  uniform float u_vignette;

  // Resolution
  uniform vec2 u_resolution;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  void main() {
    // ── 0. Crossfade between previous and current frame ──
    vec4 current = texture2D(u_texCurrent, v_uv);
    vec4 prev = texture2D(u_texPrev, v_uv);
    vec4 blurred = texture2D(u_texBlurred, v_uv);
    vec3 color = mix(prev.rgb, current.rgb, u_crossfade);

    // ── 1. Ink-wash desaturation ──
    float lum = dot(color, vec3(0.2126, 0.7152, 0.0722));
    vec3 gray = vec3(lum);

    // Ink-wash toning: warm shadows, cool highlights
    float shadowMask = 1.0 - smoothstep(0.0, 0.5, lum);
    float highlightMask = smoothstep(0.5, 1.0, lum);
    gray += u_shadowTint * shadowMask * 0.15;
    gray += u_highlightTint * highlightMask * 0.1;

    color = mix(color, gray, u_desaturation);

    // ── 2. Ink contrast (push blacks darker, keep misty whites) ──
    color = color * color * (3.0 - 2.0 * color); // smoothstep-like S-curve
    color = mix(gray, color, u_inkContrast);
    lum = dot(color, vec3(0.2126, 0.7152, 0.0722));

    // ── 3. Atmospheric depth fog ──
    float depthProxy = smoothstep(0.15, 0.75, lum);
    float verticalFog = smoothstep(0.0, u_fogHeight, v_uv.y);
    float fogAmount = depthProxy * u_fogDensity + verticalFog * u_fogDensity * 0.4;
    fogAmount = clamp(fogAmount, 0.0, 0.85);

    vec3 fogColor = vec3(u_fogBrightness, u_fogBrightness * 0.98, u_fogBrightness * 0.96);
    color = mix(color, fogColor, fogAmount);

    // ── 4. Volumetric light columns ──
    float colDist = abs(v_uv.x - 0.5) / u_volumetricWidth;
    float lightCol = exp(-colDist * colDist * 4.0);
    float lightVertical = smoothstep(1.0 - u_volumetricY, u_volumetricY, v_uv.y);
    lightVertical = lightVertical * 0.7 + 0.3;
    float volumetric = lightCol * lightVertical * u_volumetricStrength;
    color += vec3(volumetric) * fogAmount;

    // ── 5. Halation on bright fog only ──
    float blurredLum = dot(blurred.rgb, vec3(0.2126, 0.7152, 0.0722));
    float brightFogMask = smoothstep(0.55, 0.85, blurredLum);
    color += blurred.rgb * brightFogMask * u_halation;

    // ── 6. Highlight contrast rolloff (filmic) ──
    color = color / (color + vec3(0.45));
    color *= 1.45;

    // ── 7. Film grain ──
    float grain = (hash21(v_uv * u_resolution + fract(u_time * 37.0) * 100.0) - 0.5)
                  * u_grainIntensity;
    color += grain;

    // ── 8. Soft vignette ──
    vec2 vigUV = v_uv - 0.5;
    vigUV.x *= 1.3;
    float vig = 1.0 - u_vignette * dot(vigUV, vigUV) * 2.0;
    color *= vig;

    color = clamp(color, 0.0, 1.0);
    gl_FragColor = vec4(color, 1.0);
  }
`;
