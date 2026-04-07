# DECISIONS.md — The Future Wall SD

Architectural and technical decisions for this project. Referenced by CLAUDE.md, GEMINI.md, and AGENTS.md.

---

## D001: StreamDiffusion as shader approximation, not real diffusion

**Date:** 2026-03-31
**Status:** Accepted
**Context:** Client wants the StreamDiffusion aesthetic (progressive denoising, fluid morphing) for the wall projection. Running actual diffusion inference in the browser is infeasible at 60fps.
**Decision:** Implement a GLSL fragment shader that visually approximates the 3-phase StreamDiffusion look: noise injection (0.0-0.3), per-pixel staggered blend (0.3-0.7), denoise resolve (0.7-1.0). All parameters are tunable via leva for client approval.
**Consequences:** The effect is convincing but not physically accurate. It can run at 60fps on any GPU. Tuning via leva controls is essential for matching the reference material during client walkthroughs.

## D002: Free-tier only for prototype

**Date:** 2026-03-31
**Status:** Accepted
**Context:** This is an approval prototype, not production. Budget is zero.
**Decision:** Use only free-tier services: HF Inference API ($0.10/month credits), Firebase Spark plan (free), Web Speech API (browser-native). No paid APIs.
**Consequences:** Image generation speed depends on HF free-tier availability. If the prototype is approved, production will need paid HF Pro or self-hosted inference.

## D003: img2img with base composition + txt2img fallback

**Date:** 2026-03-31
**Status:** Accepted
**Context:** All generated images must maintain the Singapore waterfront panoramic composition and watercolour style from base-img.png.
**Decision:** Use HF Inference img2img with base-img.png as init image. If img2img fails (model doesn't support it or API error), fall back to txt2img with the style guardrail system prompt.
**Consequences:** img2img preserves composition reliably. txt2img fallback may drift from the base layout but style guardrails keep the palette/mood consistent.

## D004: Single Zustand store for both pages

**Date:** 2026-03-31
**Status:** Accepted
**Context:** The input page and wall page share state (generated visions flow from input to wall).
**Decision:** Single `useWallStore` with two sections: input FSM (phase, transcript, prompt) and wall (vision queue, dream images, morph progress). InputPage pushes visions directly to the wall queue for immediate display.
**Consequences:** Simple state model. The Firestore listener provides a secondary path for wall updates, so even if direct push fails, visions still appear.

## D005: Pure WebGL (no Three.js) for morph canvas

**Date:** 2026-03-31
**Status:** Accepted
**Context:** The morph effect is a single fullscreen quad with a fragment shader. Three.js would add ~150KB for no benefit.
**Decision:** Use raw WebGL: compile shader program once, fullscreen quad, 17 cached uniform locations, dual texture management, rAF render loop.
**Consequences:** Minimal bundle size. No abstraction layer between shader uniforms and leva controls. Trade-off is more boilerplate in MorphCanvas.jsx but the component is self-contained.

## D006: Hash-based noise (no texture dependency)

**Date:** 2026-03-31
**Status:** Accepted
**Context:** The shader needs value noise and fBm for displacement, grain, and per-pixel stagger.
**Decision:** Use hash-based pseudo-random (`hash21`) with smoothstep interpolation for value noise, 4-octave fBm built on top. No noise texture sampler needed.
**Consequences:** Fully self-contained shader. Slightly more ALU cost than texture-based noise but eliminates texture loading/binding complexity and works identically on all GPUs.

## D007: Bloom as single-pass approximation

**Date:** 2026-04-02
**Status:** Accepted
**Context:** True bloom requires multi-pass rendering with framebuffers (bright pass + gaussian blur + composite). This adds significant WebGL complexity.
**Decision:** Approximate bloom in the fragment shader with 8-tap radial sampling: extract bright areas (luminance > 0.6), weight them, and add back scaled by `bloomStrength`. Controlled via leva.
**Consequences:** Not physically accurate bloom but enhances golden lights and aurora glow convincingly. No framebuffer management needed. Cost is 8 additional texture samples per pixel.

## D008: Retry with exponential backoff for API calls

**Date:** 2026-04-02
**Status:** Accepted
**Context:** HF Inference API on free tier can be unreliable. Cloud Functions may cold-start.
**Decision:** VoiceCapture retries submitVision up to 3x with exponential backoff (1s, 2s, 4s + jitter, capped at 8s). Only shows error after all attempts fail.
**Consequences:** Better resilience for prototype demos. The visitor experience is smoother even with transient API failures.

## D009: Firestore graceful degradation to dream cycling

**Date:** 2026-04-02
**Status:** Accepted
**Context:** If Firestore loses connection, the wall page should not break.
**Decision:** The onSnapshot error callback logs a warning but does nothing else. The wall naturally falls back to dream cycling (isIdle: true is the default state).
**Consequences:** The wall always shows something. No blank screens or error states on the projection.

## D010: Visions page as admin/debug tool

**Date:** 2026-04-02
**Status:** Accepted
**Context:** Need a way to inspect submitted visions during development and client demos.
**Decision:** Add a `/visions` route that fetches from GET /api/visions and displays each vision as a card with raw transcript, enriched prompt, generated image, and timestamp.
**Consequences:** Useful for debugging the prompt enrichment pipeline and reviewing image quality. Not intended for visitors — no link from the input or wall pages.

## D012: 4-FBO feedback loop replaces single-pass transition shader

**Date:** 2026-04-06
**Status:** Superseded by D013
**Context:** The original shader (D001) approximated StreamDiffusion with a 3-phase crossfade between two images. After manual testing, this only produced a transition effect — not the continuous organic morphing that StreamDiffusion creates through iterative frame-to-frame diffusion.
**Decision:** Replace with a 4-FBO multi-pass feedback pipeline with displacement-based warping.
**Consequences:** Produced flowing watercolour effect instead of StreamDiffusion's in-place regeneration. Superseded by D013.

## D013: Stochastic regeneration shader (replaces displacement warp)

**Date:** 2026-04-06
**Status:** Accepted (supersedes D001, D007, D012)
**Context:** The displacement-warp feedback loop (D012) created a flowing watercolour effect — pixels warped along noise-driven UV offsets. Real StreamDiffusion (ref: github.com/cumulo-autumn/streamdiffusion, youtube.com/watch?v=h_-DZxn2P5U) re-generates the image in place each frame via diffusion denoising. The visual result is per-pixel shimmer/flicker with stable composition, not directional flow.
**Decision:** Replace displacement warp with stochastic per-pixel regeneration:
- **No UV displacement** — pixels read from the same position each frame (no flow)
- **Regeneration mask**: Each frame, a random subset of pixels (~15%) are pulled hard toward the target image (regenPull ~0.6), simulating diffusion re-generation. Other pixels retain previous value with gentle drift (pullStrength ~0.01).
- **Stochastic jitter**: Regenerated pixels sample the target with slight random offset (~1px), creating shimmer.
- **Shimmer overlay**: All pixels get subtle per-frame brightness perturbation (diffusion noise aesthetic).
- **Mild blur**: Separable gaussian (radius ~2, mix ~8%) — StreamDiffusion output is relatively crisp.
- 4-FBO pipeline retained (accumA/B ping-pong, blurH, blurV, composite to screen).
**Consequences:** Effect now matches StreamDiffusion's in-place regeneration aesthetic. Verified by automated UAT suite (8 criteria: no flow, per-pixel independence, temporal coherence, continuous regeneration, composition stability, crispness, smooth convergence, distributed shimmer).

## D014: UAT agent for StreamDiffusion visual acceptance

**Date:** 2026-04-06
**Status:** Accepted
**Context:** Visual effects are hard to test — manual inspection doesn't scale and is subjective. Need automated verification that the shader output matches StreamDiffusion reference characteristics (not watercolour flow).
**Decision:** Playwright-based UAT test suite (`e2e/uat-streamdiffusion.spec.js`) that captures frames via canvas screenshot, computes statistical properties, and produces a structured JSON report with 8 acceptance criteria:
1. No directional flow (flow magnitude < 2.0)
2. Per-pixel independence (neighbour correlation < 0.75)
3. Temporal coherence (MAD 0.2–20 between frames)
4. Continuous regeneration (no frozen frame pairs)
5. Composition stability (centroid drift < 4px)
6. Crispness (spatial coherence 2–40)
7. Smooth convergence (max single-frame MAD < 50)
8. Distributed shimmer (change ratio > 10%)

Run via `pnpm test:uat`. Always included in `pnpm test:e2e` pipeline.
**Consequences:** Shader changes that regress toward watercolour flow or break StreamDiffusion aesthetics are caught automatically. Report provides specific metrics for debugging.

## D011: Playwright for e2e testing (not Vitest)

**Date:** 2026-04-02
**Status:** Accepted
**Context:** The app is primarily a visual/interactive prototype. Unit tests would mostly test React rendering, which is less valuable than verifying the actual pages load, routes work, and kiosk mode activates.
**Decision:** Use Playwright CLI tests against the Vite preview server. Tests cover routing, page rendering, WebGL canvas, kiosk mode, design tokens, and the visions page (with API mocking).
**Consequences:** 31 e2e tests provide confidence that the app works end-to-end. No Vitest/RTL setup needed for the prototype phase.

## D015: Local diffusion inference replaces shader feedback loop

**Date:** 2026-04-06
**Status:** Accepted (supersedes D001, D013)
**Context:** The WebGL shader feedback loop (4-FBO stochastic per-pixel regeneration) could not convincingly replicate actual diffusion-based morphing. Shader effects look like shader effects, not real img2img transitions. The user wants authentic diffusion transitions between vision images.
**Decision:** Replace the shader feedback loop with a local Python inference server (FastAPI + diffusers + sd-turbo) that generates real interpolation frames via chained img2img with progressive denoising strength. The MorphCanvas component is simplified to a frame display with the ink-wash composite shader as post-processing. The inference server runs on localhost:8000, proxied through Vite at /inference. Falls back to direct image swap when the server is unavailable.
**Consequences:** Transitions are actual diffusion steps, visually authentic. Requires Python + torch + ~3.3GB model download. Transition latency ~8-16s for 8 frames on Apple Silicon MPS. The ink-wash composite shader (desaturation, fog, volumetric light, halation, grain, vignette) still provides consistent visual styling across all frames.
