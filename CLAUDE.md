# The Future Wall SD — Claude Context

> Project-specific context for Claude Code / Claude Desktop.
> Parent conventions: see root `CLAUDE.md` in the KR+D repo (coding style, data privacy, git workflow, exhibition patterns).
> Decisions: see [`DECISIONS.md`](DECISIONS.md) for all architectural and technical choices with rationale.

## Project Identity

- **Exhibit:** IC-30C Future Word Wall, NMS SHG Conclusion Space
- **Type:** Interactive generative installation prototype (web app)
- **Stack:** React 19 + Vite 8, Zustand, leva, Firebase (Hosting + Functions + Firestore + Storage)
- **Image gen:** HF Inference API (free credits) — FLUX.1-schnell (see D002, D003)
- **Speech-to-text:** Web Speech API (browser-native)
- **Package manager:** pnpm
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

### StreamDiffusion Shader (D001, D005, D006, D007)
GLSL fragment shader approximating StreamDiffusion's 3-phase transition. Pure WebGL (no Three.js). Hash-based noise, 4-octave fBm. Single-pass bloom. All parameters via leva controls (`?controls=true` or `Ctrl+Shift+L`).

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
| Shader | `organisms/MorphCanvas/` (morphShader.js, MorphCanvas.jsx, useLevaControls.js) |
| Hooks | `useSpeechRecognition`, `useVisionListener`, `useVisionCycle`, `useIdleTimeout` |
| Store | `stores/useWallStore.js` |
| Config | `config/index.js` (timing, leva defaults, asset paths) |
| Services | `services/api.js`, `services/firebase.js`, `services/visionService.js` |
| Backend | `functions/` (Cloud Functions: vision route, promptEnricher, imageGenerator, styleGuardrails) |
| Tokens | `styles/tokens.css` (palette from base-img.png) |
| Tests | `e2e/` (Playwright — routing, input, wall, kiosk, tokens, visions) (D011) |

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
pnpm dev          # Dev server (port 5173)
pnpm build        # Production build to dist/
pnpm preview      # Preview production build
pnpm test:e2e     # Playwright e2e tests (31 tests)
```

## Build Status
All phases complete:
1. **Scaffold** — routing, page shells, MicButton, tokens, config, store
2. **Voice pipeline** — speech recognition, VoiceCapture, Cloud Functions, Firestore listener, prompt enrichment
3. **Image generation** — submit→generate→display, crossfade, idle/visitor modes, dream generation
4. **StreamDiffusion shader** — GLSL morph (3-phase), MorphCanvas WebGL, leva controls, eased animation
5. **Polish** — kiosk mode, retry/backoff, offline fallback, bloom, image preview, visions page
