# The Future Wall SD

Interactive generative wall installation prototype for the NMS Singapore History Gallery Conclusion Space. Visitors speak their vision of Singapore's future, which gets transformed into AI-generated images that morph into a continuously evolving projected wall display using a StreamDiffusion-style shader effect.

## Stack

React 19 + Vite 8 | Zustand | leva | Firebase | HF Inference API (FLUX.1-schnell) | WebGL | Playwright

## Quick Start

```bash
pnpm install
```

### Run with mock API (no HF token needed)

```bash
# Terminal 1 — API server (mock mode, returns dream images)
cd functions && MOCK=1 node dev-server.js

# Terminal 2 — Frontend
pnpm dev
```

Open http://localhost:5173

### Run with real HF API

```bash
# Terminal 1 — API server (live mode)
cd functions && HF_TOKEN=hf_your_token node dev-server.js

# Terminal 2 — Frontend
pnpm dev
```

Get a free HF token at https://huggingface.co/settings/tokens — enable **"Make calls to Inference Providers"** permission.

## Testing

### Automated (Playwright e2e)

```bash
pnpm build && pnpm test:e2e
```

Runs 31 tests across 6 suites (routing, input page, wall page, kiosk mode, design tokens, visions page).

```bash
# Run a single suite
pnpm exec playwright test e2e/wall-page.spec.js

# Run headed (see the browser)
pnpm exec playwright test --headed

# Debug interactively
pnpm exec playwright test --debug e2e/input-page.spec.js
```

### Manual Testing

#### 1. Wall page (morph shader)

Open http://localhost:5173/wall — the canvas cycles through 6 pre-generated dream images with the StreamDiffusion morph transition.

- **With leva controls:** http://localhost:5173/wall?controls=true — adjust morph timing, noise, displacement, blend, bloom, vignette, color temperature in real time.
- **Debug mode:** In the leva panel, check "freezeProgress" and drag "manualProgress" to scrub through the transition phases manually.
- **Kiosk mode:** http://localhost:5173/wall?kiosk — fullscreen on first click, cursor hidden, context menu blocked, pinch-zoom disabled.
- **F11:** Toggles fullscreen on any page.
- **Ctrl+Shift+L:** Toggles leva panel visibility.

#### 2. Input page (voice capture)

Open http://localhost:5173/input — requires a microphone.

1. Press and hold the mic button to record.
2. Speak your vision (e.g. "I imagine floating gardens above Marina Bay").
3. Release — recording stops after 3s of silence or on release.
4. The transcript is sent to the API, enriched into an image prompt, and an image is generated.
5. A preview thumbnail appears with "Your vision is now on the wall".
6. After 60s idle, the page resets.

**Without a microphone:** Submit visions directly via curl:
```bash
curl -X POST http://localhost:5001/api/vision \
  -H "Content-Type: application/json" \
  -d '{"text":"coral reefs surrounding the city"}'
```

#### 3. Visions page (admin/debug)

Open http://localhost:5173/visions — lists all submitted visions with:
- Raw transcript (what the visitor said)
- Enriched prompt (what was sent to the image model)
- Generated image
- Timestamp

This page fetches from `GET /api/visions`. Requires the API server to be running.

#### 4. API endpoints

```bash
# Health check
curl http://localhost:5001/api/health

# Submit a vision
curl -X POST http://localhost:5001/api/vision \
  -H "Content-Type: application/json" \
  -d '{"text":"your vision text here"}'

# List all completed visions
curl http://localhost:5001/api/visions
```

## Pages

| Route | Purpose |
|-------|---------|
| `/wall` | Fullscreen morph canvas (default) |
| `/input` | Voice capture + submission |
| `/visions` | Admin list of all submitted visions |
| `/` | Redirects to `/wall` |

## Project Structure

```
src/
  components/
    atoms/          MicButton, StatusIndicator
    molecules/      TranscriptDisplay
    organisms/      VoiceCapture, MorphCanvas (WebGL shader)
    pages/          InputPage, WallPage, VisionsPage
  hooks/            useSpeechRecognition, useVisionCycle, useVisionListener, useIdleTimeout
  stores/           useWallStore (Zustand)
  services/         api, firebase, visionService
  config/           Constants, timing, leva defaults
  styles/           Design tokens, global CSS
functions/
  dev-server.js     Standalone dev API server (no Firebase emulators needed)
  routes/           POST /api/vision, GET /api/visions
  services/         promptEnricher, imageGenerator, styleGuardrails
e2e/                Playwright test suites
spec/               Technical blueprint
```

## Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Dev server (port 5173) |
| `pnpm build` | Production build to `dist/` |
| `pnpm preview` | Preview production build |
| `pnpm test:e2e` | Run Playwright e2e tests (31 tests) |
