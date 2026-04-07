import { useRef, useEffect, useCallback } from 'react';
import {
  vertexShader,
  blurFragment,
  compositeFragment,
} from './morphShader';
import { ASPECT_RATIO, DIFFUSION_TRANSITION } from '@/config';
import { preloadImage } from '@/utils/imageLoader';
import styles from './MorphCanvas.module.css';

/**
 * Frame display canvas with ink-wash composite post-processing.
 *
 * Receives diffusion frames from the local inference server and renders
 * them through the ink-wash composite shader for consistent visual style.
 *
 * Per-frame pipeline:
 *   1. Blur H:     horizontal gaussian on current frame (halation source)
 *   2. Blur V:     vertical gaussian
 *   3. Composite:  crossfade prev/current + ink-wash + fog + volumetrics → screen
 */
export function MorphCanvas({ frameSrc, controls }) {
  const canvasRef = useRef(null);
  const glRef = useRef(null);
  const programsRef = useRef({ blur: null, composite: null });
  const uniformsRef = useRef({ blur: {}, composite: {} });
  const fbosRef = useRef({ blurH: null, blurV: null });
  const currentTexRef = useRef(null);
  const prevTexRef = useRef(null);
  const loadedFrameRef = useRef(null);
  const crossfadeRef = useRef(1.0);
  const crossfadeStartRef = useRef(0);
  const startTimeRef = useRef(performance.now() / 1000);
  const rafRef = useRef(null);
  const isInitializedRef = useRef(false);

  // ── Helpers ──

  const compileShader = useCallback((gl, type, source) => {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('Shader compile:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }, []);

  const buildProgram = useCallback((gl, fragSource) => {
    const vs = compileShader(gl, gl.VERTEX_SHADER, vertexShader);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragSource);
    if (!vs || !fs) return null;

    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.bindAttribLocation(program, 0, 'a_position');
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link:', gl.getProgramInfoLog(program));
      return null;
    }

    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return program;
  }, [compileShader]);

  const getUniforms = useCallback((gl, program, names) => {
    const map = {};
    for (const name of names) {
      map[name] = gl.getUniformLocation(program, name);
    }
    return map;
  }, []);

  const createFBO = useCallback((gl, width, height) => {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { framebuffer: fb, texture: tex, width, height };
  }, []);

  const resizeFBO = useCallback((gl, fbo, width, height) => {
    if (fbo.width === width && fbo.height === height) return fbo;
    gl.bindTexture(gl.TEXTURE_2D, fbo.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    fbo.width = width;
    fbo.height = height;
    return fbo;
  }, []);

  const createTexture = useCallback((gl) => {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    const placeholder = new Uint8Array([10, 14, 26, 255]);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, placeholder);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return tex;
  }, []);

  // ── Init WebGL ──

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl', { alpha: false, antialias: false, preserveDrawingBuffer: false });
    if (!gl) {
      console.error('WebGL not supported');
      return;
    }

    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

    const blurProg = buildProgram(gl, blurFragment);
    const compositeProg = buildProgram(gl, compositeFragment);

    if (!blurProg || !compositeProg) {
      console.error('Failed to compile shader programs');
      return;
    }

    programsRef.current = { blur: blurProg, composite: compositeProg };

    // Cache uniform locations
    uniformsRef.current.blur = getUniforms(gl, blurProg, [
      'u_tex', 'u_direction', 'u_blurRadius', 'u_resolution',
    ]);
    uniformsRef.current.composite = getUniforms(gl, compositeProg, [
      'u_texCurrent', 'u_texPrev', 'u_texBlurred',
      'u_crossfade', 'u_time',
      'u_desaturation', 'u_inkContrast',
      'u_shadowTint', 'u_highlightTint',
      'u_fogDensity', 'u_fogBrightness', 'u_fogHeight',
      'u_volumetricStrength', 'u_volumetricWidth', 'u_volumetricY',
      'u_halation', 'u_grainIntensity', 'u_vignette',
      'u_resolution',
    ]);

    // Fullscreen quad VBO
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    // Create 2 FBOs (blur only)
    const w = canvas.width || 512;
    const h = canvas.height || 256;
    fbosRef.current = {
      blurH: createFBO(gl, w, h),
      blurV: createFBO(gl, w, h),
    };

    // Create frame textures (current + previous for crossfade)
    currentTexRef.current = createTexture(gl);
    prevTexRef.current = createTexture(gl);

    glRef.current = gl;
    isInitializedRef.current = true;

    return () => {
      cancelAnimationFrame(rafRef.current);
      isInitializedRef.current = false;
      const f = fbosRef.current;
      for (const key of Object.keys(f)) {
        if (f[key]) {
          gl.deleteTexture(f[key].texture);
          gl.deleteFramebuffer(f[key].framebuffer);
        }
      }
      if (currentTexRef.current) gl.deleteTexture(currentTexRef.current);
      if (prevTexRef.current) gl.deleteTexture(prevTexRef.current);
    };
  }, [buildProgram, getUniforms, createFBO, createTexture]);

  // ── Load frame image into texture ──

  useEffect(() => {
    if (!frameSrc || frameSrc === loadedFrameRef.current) return;

    const gl = glRef.current;
    if (!gl) return;

    preloadImage(frameSrc)
      .then((img) => {
        if (!glRef.current) return;

        // Copy current → prev for crossfade
        // (Swap texture references — prev gets old current)
        const oldCurrent = currentTexRef.current;
        const oldPrev = prevTexRef.current;

        // Upload new image to the prev texture slot (reuse it as new current)
        gl.bindTexture(gl.TEXTURE_2D, oldPrev);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);

        // Swap: old prev (now loaded with new image) becomes current,
        // old current becomes prev
        currentTexRef.current = oldPrev;
        prevTexRef.current = oldCurrent;

        loadedFrameRef.current = frameSrc;

        // Start crossfade
        crossfadeRef.current = 0.0;
        crossfadeStartRef.current = performance.now();
      })
      .catch((err) => console.warn('Frame image load failed:', err));
  }, [frameSrc]);

  // ── Render loop ──

  useEffect(() => {
    if (!isInitializedRef.current) return;

    const gl = glRef.current;
    const progs = programsRef.current;
    const us = uniformsRef.current;
    if (!gl || !progs.blur) return;

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
      }

      // Resize FBOs if needed
      const fbos = fbosRef.current;
      for (const key of Object.keys(fbos)) {
        resizeFBO(gl, fbos[key], w, h);
      }

      const t = performance.now() / 1000 - startTimeRef.current;

      // Animate crossfade
      const c = controls || {};
      const crossfadeMs = c.transition?.crossfadeMs ?? DIFFUSION_TRANSITION.CROSSFADE_MS;
      const elapsed = performance.now() - crossfadeStartRef.current;
      crossfadeRef.current = Math.min(1.0, elapsed / crossfadeMs);

      const ink = c.inkWash || {};
      const fogC = c.fog || {};
      const vol = c.volumetric || {};
      const post = c.post || {};

      // ── Pass 1: Blur H ──
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbos.blurH.framebuffer);
      gl.viewport(0, 0, w, h);
      gl.useProgram(progs.blur);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, currentTexRef.current);
      gl.uniform1i(us.blur.u_tex, 0);
      gl.uniform2f(us.blur.u_direction, 1.0, 0.0);
      gl.uniform1f(us.blur.u_blurRadius, post.blurRadius ?? 1.5);
      gl.uniform2f(us.blur.u_resolution, w, h);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      // ── Pass 2: Blur V ──
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbos.blurV.framebuffer);
      gl.viewport(0, 0, w, h);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, fbos.blurH.texture);
      gl.uniform1i(us.blur.u_tex, 0);
      gl.uniform2f(us.blur.u_direction, 0.0, 1.0);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      // ── Pass 3: Composite → screen ──
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, w, h);
      gl.useProgram(progs.composite);

      // Frame textures
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, currentTexRef.current);
      gl.uniform1i(us.composite.u_texCurrent, 0);

      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, prevTexRef.current);
      gl.uniform1i(us.composite.u_texPrev, 1);

      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, fbos.blurV.texture);
      gl.uniform1i(us.composite.u_texBlurred, 2);

      gl.uniform1f(us.composite.u_crossfade, crossfadeRef.current);
      gl.uniform1f(us.composite.u_time, t);

      // Ink-wash style
      gl.uniform1f(us.composite.u_desaturation, ink.desaturation ?? 0.90);
      gl.uniform1f(us.composite.u_inkContrast, ink.inkContrast ?? 0.6);
      const st = ink.shadowTint ?? [0.12, 0.08, 0.06];
      gl.uniform3f(us.composite.u_shadowTint, st[0], st[1], st[2]);
      const ht = ink.highlightTint ?? [0.06, 0.08, 0.12];
      gl.uniform3f(us.composite.u_highlightTint, ht[0], ht[1], ht[2]);

      // Atmospheric fog
      gl.uniform1f(us.composite.u_fogDensity, fogC.fogDensity ?? 0.18);
      gl.uniform1f(us.composite.u_fogBrightness, fogC.fogBrightness ?? 0.65);
      gl.uniform1f(us.composite.u_fogHeight, fogC.fogHeight ?? 0.5);

      // Volumetric light
      gl.uniform1f(us.composite.u_volumetricStrength, vol.strength ?? 0.10);
      gl.uniform1f(us.composite.u_volumetricWidth, vol.width ?? 0.4);
      gl.uniform1f(us.composite.u_volumetricY, vol.y ?? 0.3);

      // Post
      gl.uniform1f(us.composite.u_halation, post.halation ?? 0.06);
      gl.uniform1f(us.composite.u_grainIntensity, post.grainIntensity ?? 0.06);
      gl.uniform1f(us.composite.u_vignette, post.vignette ?? 0.35);
      gl.uniform2f(us.composite.u_resolution, w, h);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      rafRef.current = requestAnimationFrame(render);
    };

    rafRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(rafRef.current);
  }, [controls, resizeFBO]);

  return (
    <div className={styles.wrap} style={{ aspectRatio: ASPECT_RATIO }}>
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  );
}
