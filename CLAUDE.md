# The Future Wall SD — Claude Context

> Project-specific context for Claude Code / Claude Desktop.
> Parent conventions: see root `CLAUDE.md` in the KR+D repo (coding style, data privacy, git workflow, exhibition patterns).
> Decisions: see [`DECISIONS.md`](DECISIONS.md) for all architectural and technical choices with rationale.

## Project Identity

- **Exhibit:** IC-30C Future Word Wall, NMS SHG Conclusion Space
- **Type:** Interactive generative installation prototype (web app)
- **Stack:** React 19 + Vite 8, Zustand, leva, Firebase (Hosting + Functions + Firestore + Storage)
- **Image gen:** HF Inference API (FLUX.1-schnell) for visitor visions (D002, D003); local sd-turbo inference for diffusion transitions (D015)
- **Inference server:** Python FastAPI + diffusers + sd-turbo (Apple Silicon MPS / CUDA) — `inference-server/`
- **Speech-to-text:** Web Speech API (browser-native)
- **Package manager:** pnpm (frontend), pip/venv (inference server)
- **Spec:** `spec/technical-blueprint.md`

## Architecture

### Pages
| Route | Component | Purpose |
|-------|-----------|---------|
| `/input` | InputPage | Voice capture: mic button, transcript, submission |
| `/wall` | WallPage | Fullscreen morph canvas, StreamDiffusion-style transitions |
| `/visions` | VisionsPage | Admin/debug list of submitted visions (D010) |
| `/` | — | Redirects to `/wall` |

### Image Pipeline
Visitor speaks → Web Speech API → POST /api/vision (Cloud Function) → HF enrichment + generation → Firebase Storage + Firestore → Wall via onSnapshot

### Local Diffusion Inference (D015, supersedes D001/D013)
Local Python inference server generates real diffusion transitions via chained img2img with progressive denoising strength (sd-turbo). The MorphCanvas receives frames and renders through an ink-wash composite shader (desaturation, fog, volumetric light, halation, grain, vignette) for consistent visual styling. Falls back to direct image swap when inference server is unavailable.

**Endpoints:** `GET /health`, `POST /generate` (txt2img), `POST /img2img`, `POST /interpolate` (N frames between two images).
**Performance:** ~8–16s for 8 interpolation frames on Apple Silicon MPS.
**Visual controls:** leva (`?controls=true` or `Ctrl+Shift+L`) for ink-wash shader params.

### State (D004)
Single Zustand store (`useWallStore.js`): input FSM (idle → recording → generating → done | error) + wall (vision queue, dream images, morph progress 0-1).

### Error Handling (D008, D009)
API retries (3x exponential backoff). Firestore disconnection falls back to dream cycling silently.

## Key Files
| Area | Files |
|------|-------|
| Router | `src/App.jsx` |
| Pages | `src/components/pages/{InputPage,WallPage,VisionsPage}/` |
| Voice UI | `atoms/MicButton`, `atoms/StatusIndicator`, `molecules/TranscriptDisplay`, `organisms/VoiceCapture` |
| Ink-wash canvas | `organisms/MorphCanvas/` (morphShader.js, MorphCanvas.jsx, useLevaControls.js) |
| Hooks | `useSpeechRecognition`, `useVisionListener`, `useVisionCycle`, `useIdleTimeout` |
| Store | `stores/useWallStore.js` |
| Config | `config/index.js` (timing, leva defaults, asset paths) |
| Services | `services/api.js`, `services/firebase.js`, `services/visionService.js`, `services/inferenceService.js` |
| Inference server | `inference-server/` (FastAPI server.py, download_model.py, requirements.txt) |
| Backend | `functions/` (Cloud Functions: vision route, promptEnricher, imageGenerator, styleGuardrails) |
| Tokens | `styles/tokens.css` (palette from base-img.png) |
| Tests | `e2e/` (Playwright — routing, input, wall, kiosk, tokens, visions, morph-effect, UAT) (D011, D014) |

## Assets
- `public/assets/textures/base-img.png` — Base composition (Singapore waterfront panoramic watercolour, 1680x720)
- `public/assets/dreams/` — 6 pre-generated dream images for idle cycling
- `public/assets/generated/` — AI-generated visions (gitignored)

## Conventions
Follows parent KR+D conventions (see root `CLAUDE.md`). Project-specific choices:
- JavaScript (ES2020+) with JSX — no TypeScript
- CSS Modules (BEM-lite), not Tailwind
- Playwright for e2e tests (not Vitest — see D011)
- Design tokens for all visual values, never hardcode

## Commands
```
# Frontend
pnpm dev          # Dev server (port 5173), proxies /inference to localhost:8000
pnpm build        # Production build to dist/
pnpm preview      # Preview production build
pnpm test:e2e     # Playwright e2e tests (all suites including UAT)
pnpm test:uat     # UAT only — StreamDiffusion visual acceptance (8 criteria)

# Inference server
cd inference-server
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python download_model.py           # Download sd-turbo (~3.3GB, one-time)
uvicorn server:app --host 0.0.0.0 --port 8000   # Start inference server
```

## Build Status
All phases complete:
1. **Scaffold** — routing, page shells, MicButton, tokens, config, store
2. **Voice pipeline** — speech recognition, VoiceCapture, Cloud Functions, Firestore listener, prompt enrichment
3. **Image generation** — submit→generate→display, crossfade, idle/visitor modes, dream generation
4. **StreamDiffusion pipeline** — ~~4-FBO stochastic regeneration~~ replaced by local sd-turbo inference (D015): real diffusion img2img transitions + ink-wash composite shader
5. **Polish** — kiosk mode, retry/backoff, offline fallback, bloom, image preview, visions page
6. **Local inference** — FastAPI + sd-turbo server, interpolation endpoint, inferenceService client, Vite proxy, graceful fallback
