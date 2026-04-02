import { useRef, useEffect, useCallback } from 'react';
import { vertexShader, fragmentShader } from './morphShader';
import { ASPECT_RATIO } from '@/config';
import styles from './MorphCanvas.module.css';

/**
 * WebGL canvas that renders the StreamDiffusion-style morph transition.
 *
 * Props:
 *  - currentSrc: string — URL of the current image
 *  - nextSrc: string — URL of the next image
 *  - progress: number 0–1 — morph progress
 *  - controls: object — leva control values (noise, displacement, blend, post, debug)
 */
export function MorphCanvas({ currentSrc, nextSrc, progress, controls }) {
  const canvasRef = useRef(null);
  const glRef = useRef(null);
  const programRef = useRef(null);
  const uniformsRef = useRef({});
  const texturesRef = useRef({ current: null, next: null });
  const startTimeRef = useRef(performance.now() / 1000);
  const rafRef = useRef(null);
  const loadedSrcsRef = useRef({ current: null, next: null });

  // Compile shader program once
  const initGL = useCallback((canvas) => {
    const gl = canvas.getContext('webgl', { alpha: false, antialias: false });
    if (!gl) {
      console.error('WebGL not supported');
      return null;
    }

    // Compile shaders
    const vs = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vs, vertexShader);
    gl.compileShader(vs);
    if (!gl.getShaderInfoLog(vs) === '') {
      const log = gl.getShaderInfoLog(vs);
      if (log) console.warn('Vertex shader:', log);
    }

    const fs = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fs, fragmentShader);
    gl.compileShader(fs);
    if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
      console.error('Fragment shader:', gl.getShaderInfoLog(fs));
      return null;
    }

    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link:', gl.getProgramInfoLog(program));
      return null;
    }
    gl.useProgram(program);

    // Fullscreen quad
    const posBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );
    const posLoc = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    // Cache uniform locations
    const uniforms = {};
    const names = [
      'u_texCurrent', 'u_texNext', 'u_progress', 'u_time',
      'u_noiseScale', 'u_noiseIntensity', 'u_noiseSpeed', 'u_grainSize', 'u_colorBleed',
      'u_displacementStrength', 'u_displacementFreq',
      'u_blendStagger', 'u_midNoise', 'u_edgeSoftness',
      'u_bloomStrength', 'u_bloomRadius', 'u_vignette', 'u_colorTemp',
      'u_resolution',
    ];
    for (const name of names) {
      uniforms[name] = gl.getUniformLocation(program, name);
    }

    // Set texture units
    gl.uniform1i(uniforms.u_texCurrent, 0);
    gl.uniform1i(uniforms.u_texNext, 1);

    glRef.current = gl;
    programRef.current = program;
    uniformsRef.current = uniforms;

    return gl;
  }, []);

  // Load image into a WebGL texture
  const loadTexture = useCallback((gl, image, existingTex) => {
    const tex = existingTex || gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return tex;
  }, []);

  // Load image from URL into texture slot
  const loadImageToTexture = useCallback((src, slot) => {
    const gl = glRef.current;
    if (!gl || !src) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const tex = loadTexture(gl, img, texturesRef.current[slot]);
      texturesRef.current[slot] = tex;
      loadedSrcsRef.current[slot] = src;
    };
    img.src = src;
  }, [loadTexture]);

  // Init WebGL on mount
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = initGL(canvas);
    if (!gl) return;

    // Create placeholder 1x1 textures
    const placeholder = new Uint8Array([10, 14, 26, 255]); // --color-bg-deep
    for (const slot of ['current', 'next']) {
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, placeholder);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      texturesRef.current[slot] = tex;
    }

    return () => {
      cancelAnimationFrame(rafRef.current);
      // Clean up textures
      if (texturesRef.current.current) gl.deleteTexture(texturesRef.current.current);
      if (texturesRef.current.next) gl.deleteTexture(texturesRef.current.next);
    };
  }, [initGL]);

  // Update textures when sources change
  useEffect(() => {
    if (currentSrc && currentSrc !== loadedSrcsRef.current.current) {
      loadImageToTexture(currentSrc, 'current');
    }
  }, [currentSrc, loadImageToTexture]);

  useEffect(() => {
    if (nextSrc && nextSrc !== loadedSrcsRef.current.next) {
      loadImageToTexture(nextSrc, 'next');
    }
  }, [nextSrc, loadImageToTexture]);

  // Render loop
  useEffect(() => {
    const gl = glRef.current;
    const u = uniformsRef.current;
    if (!gl) return;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Resize canvas to container
      const rect = canvas.parentElement.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio, 2);
      const w = Math.round(rect.width * dpr);
      const h = Math.round(rect.height * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }

      gl.useProgram(programRef.current);

      const t = performance.now() / 1000 - startTimeRef.current;

      // Bind textures
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texturesRef.current.current);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, texturesRef.current.next);

      // Uniforms from controls
      const c = controls || {};
      const n = c.noise || {};
      const d = c.displacement || {};
      const b = c.blend || {};
      const p = c.post || {};
      const dbg = c.debug || {};

      const effectiveProgress = dbg.freezeProgress ? dbg.manualProgress : progress;

      gl.uniform1f(u.u_progress, effectiveProgress ?? 0);
      gl.uniform1f(u.u_time, t);
      gl.uniform1f(u.u_noiseScale, n.scale ?? 1.0);
      gl.uniform1f(u.u_noiseIntensity, n.intensity ?? 0.6);
      gl.uniform1f(u.u_noiseSpeed, n.speed ?? 0.5);
      gl.uniform1f(u.u_grainSize, n.grainSize ?? 1.5);
      gl.uniform1f(u.u_colorBleed, n.colorBleed ?? 0.3);
      gl.uniform1f(u.u_displacementStrength, d.strength ?? 15);
      gl.uniform1f(u.u_displacementFreq, d.frequency ?? 0.8);
      gl.uniform1f(u.u_blendStagger, b.perPixelStagger ?? 2.5);
      gl.uniform1f(u.u_midNoise, b.midTransitionNoise ?? 0.4);
      gl.uniform1f(u.u_edgeSoftness, b.edgeSoftness ?? 0.5);
      gl.uniform1f(u.u_bloomStrength, p.bloomStrength ?? 0.7);
      gl.uniform1f(u.u_bloomRadius, p.bloomRadius ?? 0.4);
      gl.uniform1f(u.u_vignette, p.vignette ?? 0.3);
      gl.uniform1f(u.u_colorTemp, p.colorTemperature ?? 0.0);
      gl.uniform2f(u.u_resolution, canvas.width, canvas.height);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      rafRef.current = requestAnimationFrame(render);
    };

    rafRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafRef.current);
  }, [progress, controls]);

  return (
    <div className={styles.wrap} style={{ aspectRatio: ASPECT_RATIO }}>
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  );
}
