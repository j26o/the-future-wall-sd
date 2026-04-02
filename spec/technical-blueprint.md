# The Future Wall SD — Technical Blueprint

> **Project:** "Future Word Wall", NMS Singapore History Gallery, Conclusion Space
> **Type:** Interactive generative installation prototype (web app)
> **Version:** 0.1.0 — Initial spec
> **Date:** 2 April 2026
> **Author:** Roland Baldovino / Claude (spec generation)
> **Status:** DRAFT — Pending team review

---

## A. Product Understanding

### Concept Summary

The Future Wall is the left-side projection in the **Conclusion Space (CS-00)** of the NMS Singapore History Gallery. It is the culminating interactive element of the entire gallery — where visitor voices collected throughout 7 chronological zones are transformed into evolving visions of Singapore's future.

**Core narrative:** "From the reflections of our past, our voices come together to shape our future."

The wall displays a futuristic Singapore skyline that **continuously evolves via StreamDiffusion-style image interpolation**.

> **Production context (not prototype scope):** In the full Conclusion Space, visitor words — extracted as short phrases from voice recordings — travel as particles from the Past-to-Present wall, through the River of Voices floor projection, and splash up at the base of the Future Wall. This prototype focuses only on the Future Wall's image generation and morph transitions, not the cross-element particle system.

> **Note:** The New Singapore Stone sculpture has been removed from the concept. The Future Wall stands on its own as a projected surface without a foreground physical element.

### User Experience Goals

1. **Voice to vision** — Visitor speaks their vision of Singapore; it becomes a generated image that morphs into the wall
2. **Continuous evolution** — The wall never stops moving; it perpetually morphs between submitted visions via StreamDiffusion-style fluid transitions
3. **Compositional consistency** — Every generated image preserves the base composition (Singapore waterfront panorama: water foreground, supertrees/buildings mid, atmospheric sky) so the wall reads as one evolving place, not random images
4. **Poetic, contemplative mood** — Watercolour aesthetic, slow organic motion, warm/cool palette. RFA specifies: deep blues/blacks (night sky, water), gold particles (voices/text), starry white. Existing prototype interprets base-img.png as: navy sky, teal supertrees, golden lights, prismatic aurora.
5. **Low friction** — Press button, speak, see result within seconds
6. **Tuneable** — All visual effect parameters exposed via leva controls for real-time adjustment during client demos and calibration

### Installation / Prototype Constraints

- **Aspect ratio:** 2.33:1 (1680x720) — wide panoramic format
- **Display context:** Projection onto wall surface in a dark gallery space
- **Hosting:** Firebase (Hosting for frontend, Cloud Functions for backend API)
- **Budget:** Free-tier services only — no paid API keys for prototype
- **Generation speed:** Must feel responsive (<15s target for prototype)
- **Error recovery:** Auto-restart, graceful fallback if AI services fail
- **English only** for voice processing
- **No cursor, no browser chrome** — kiosk fullscreen mode
- **Production target:** TouchDesigner on Windows PC with 3x RTX A400 (but this web prototype is for rapid iteration, concept validation, and client animation/styling approval)

---

## B. Recommended Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| **Frontend** | React + Vite (JSX, ES2020+) | KR+D standard. Matches coding guidelines. Fast HMR. Use latest stable versions. |
| **State** | Zustand | KR+D standard. Simple FSM for wall states. |
| **Styling** | CSS Modules (BEM-lite) | Minimal UI surface — input page + visualization. |
| **Routing** | React Router (latest) | Two pages: `/input` and `/wall` |
| **Effect controls** | leva | Real-time GUI for tuning all morph/transition parameters during demos |
| **Backend** | Firebase Cloud Functions (Node.js) | Free Spark plan. Serverless, no infra management. |
| **Frontend hosting** | Firebase Hosting | Free Spark plan. CDN-backed. |
| **Speech-to-text** | Web Speech API (browser-native) | Zero latency, zero cost, works in Chrome/Edge kiosk. |
| **Prompt enrichment** | HF Inference API → Groq provider (free) | Free tier LLM (Llama 3/Mistral via Groq). Fast inference. |
| **Image generation** | HF Inference API → free providers | Free tier text-to-image (FLUX.1-schnell or SDXL-turbo via HF Inference). |
| **Composition control** | img2img from base image (denoise 0.3–0.5) | Preserves spatial layout of base-img.png. Style guardrail prompt enforces palette/mood. |
| **StreamDiffusion transition** | WebGL shader + server-side interpolation frames | See dedicated section below. |
| **Storage** | Firebase Storage (free tier: 5GB) + Firestore | Generated images in Storage, vision metadata in Firestore. |
| **Package manager** | pnpm | KR+D standard. |

### Free-Tier Service Mapping

> **Note:** Free tier limits below are approximate and commonly cited. Verify against the current [Firebase pricing page](https://firebase.google.com/pricing) and [HF Inference pricing](https://huggingface.co/docs/api-inference/en/pricing) before committing to this architecture.

| Service | Provider | Free Tier Limits | Usage |
|---------|----------|-----------------|-------|
| **Firebase Hosting** | Google | ~10GB storage, ~360MB/day (verify) | Static frontend |
| **Cloud Functions** | Google | ~2M invocations/month (verify) | API endpoints |
| **Firebase Storage** | Google | ~5GB storage (verify) | Generated images |
| **Firestore** | Google | ~50K reads, ~20K writes/day (verify) | Vision metadata |
| **HF Inference API** | Hugging Face | **$0.10/month free credits** (credit-based, not rate-limited) | Image generation + LLM |
| **Web Speech API** | Browser | Unlimited | Speech-to-text |

> **Important:** HF Inference API gives free users **$0.10/month in credits**, not a traditional free tier. The per-image cost depends on model and provider (e.g. HF docs cite ~$0.0012 for a 10-second FLUX.1-dev generation), so $0.10 may yield on the order of tens of images/month — enough for development and small demos but not sustained exhibition use. If credits are exhausted: (a) pre-generate a pool of images for demo day, (b) upgrade to HF Pro (paid subscription, gives $2/month in inference credits), (c) add Pollinations.ai as a zero-auth fallback (txt2img only, no API key required), or (d) use a custom provider key with a provider that has its own free tier.

### Image Generation: Model Options (Free Tier)

| Model | Provider via HF | Speed | Quality | img2img | Notes |
|-------|----------------|-------|---------|---------|-------|
| **FLUX.1-schnell** | fal, Replicate via HF router | Fast (few-step model) | Very good | Needs validation — depends on provider | Best quality/speed ratio. Preferred if img2img is supported. |
| **SDXL Turbo** | HF Inference (native) | Fast (few-step model) | Good | Needs validation | Alternative fast model, lower quality than FLUX. |
| **SD 1.5 / SDXL** | HF Inference (native) | Slower (more steps) | Good/High | Likely supported | More established, wider img2img support on HF native. |
| **Pollinations.ai** | Direct API (no key needed) | Variable | Good | No (txt2img only) | Zero-auth fallback. No img2img. No cost at all. |

> **Note:** Specific latency numbers are not provided because they depend heavily on provider load, queue times, and whether the model is warm. Benchmark during Phase 3.

> **Validation needed:** Whether img2img (image-to-image with init image) is supported for specific models on the HF Inference API free credits tier depends on the provider. This must be tested during Phase 3. If img2img is unavailable, fall back to txt2img with a very detailed composition prompt.

**Recommendation:** Start with **HF Inference API → FLUX.1-schnell** (via fal or Replicate provider) for best quality. Use **SDXL** as fallback. Add **Pollinations.ai** as zero-auth emergency fallback (txt2img only, composition preserved via prompt only). Test img2img availability early in Phase 3.

---

## C. StreamDiffusion Transition Effect

### What Is StreamDiffusion?

StreamDiffusion is a real-time diffusion pipeline that produces **fluid, progressive image morphing**. Key visual characteristics:

1. **Progressive denoising** — Images don't cut or crossfade; they appear to *emerge from noise* into clarity
2. **Temporal coherence** — Each frame is generated from the previous, creating smooth visual continuity
3. **Fluid morphing** — Structures dissolve and reform organically, as if the image is being "re-dreamed" in real time
4. **Noise-to-clarity gradient** — The transition passes through intermediate states that look like partially-denoised diffusion steps

### Implementation Strategy (Two-Tier)

#### Tier 1: Client-Side WebGL Shader (Core — always active)

> **Important:** This is a **visual approximation** of the StreamDiffusion aesthetic using a hand-crafted WebGL shader, not actual diffusion model inference in the browser. Real StreamDiffusion requires a GPU running a diffusion model (e.g. SD-turbo on an RTX GPU). The shader mimics the *look* — progressive noise, fluid morphing, denoising reveal — well enough for client approval of the animation style.

A fragment shader that simulates the StreamDiffusion visual signature:

```
Current Image → [Add progressive noise grain] → [Blend with noise-warped next image] → [Resolve to next image]
```

**Shader stages per transition:**
1. **Noise injection phase** (0.0–0.3 progress): Current image gains progressive Gaussian noise + subtle UV displacement. Looks like the image is "entering the diffusion process."
2. **Latent blend phase** (0.3–0.7 progress): Noisy current blends with noisy next using per-pixel fBm-noise-driven timing. Each pixel transitions at a different time. Displacement warping peaks here.
3. **Denoising resolve phase** (0.7–1.0 progress): Noise recedes, next image clarifies. Looks like the new image is "denoising into existence."

**Key uniforms (all exposed via leva):**
- `uProgress` — 0 to 1 morph progress
- `uNoiseScale` — Scale of noise grain texture
- `uNoiseIntensity` — Peak noise opacity (0–1)
- `uDisplacementStrength` — UV warp amplitude in pixels
- `uBlendCurve` — Exponent for per-pixel timing (higher = more staggered)
- `uNoiseSpeed` — Animated noise evolution speed
- `uGrainSize` — Size of noise grain particles
- `uColorBleed` — Amount of color mixing at morph boundary

#### Tier 2: Server-Side Interpolation Frames (Enhancement — when available)

For even more authentic StreamDiffusion look, the server generates N intermediate frames:

```
Image A → img2img(A, strength=0.15) → img2img(prev, strength=0.25) → ... → img2img(prev, strength=0.15) → Image B
```

- **Frame count:** 4–8 frames per transition (configurable)
- **Strength ramp:** Bell curve (low → peak → low) — max denoise at midpoint
- **Delivery:** Frames uploaded to Firebase Storage as they complete; Firestore doc updated with frame URLs array. Client polls or listens for updates.
- **Playback:** Client plays frames at adaptive FPS, overlaid on the WebGL shader for combined effect
- **Fallback:** If server is slow or unavailable, Tier 1 shader handles the full transition alone

### Leva Controls Panel

All morph/transition parameters are adjustable in real time via leva. The panel is visible during development and client demos, hidden in production kiosk mode.

**Control groups:**

```
StreamDiffusion Effect
├── Morph
│   ├── duration (idle)      — 8–20s, default 12s
│   ├── duration (visitor)   — 4–12s, default 8s
│   ├── pause between        — 0–5s, default 2s
│   └── easing               — linear / easeInOut / custom
├── Noise
│   ├── scale                — 0.1–5.0, default 1.0
│   ├── intensity            — 0.0–1.0, default 0.6
│   ├── speed                — 0.0–3.0, default 0.5
│   ├── grain size           — 0.5–5.0, default 1.5
│   └── color bleed          — 0.0–1.0, default 0.3
├── Displacement
│   ├── strength             — 0–50px, default 15
│   ├── frequency            — 0.1–3.0, default 0.8
│   └── direction bias       — radial / horizontal / vertical
├── Blend
│   ├── per-pixel stagger    — 1.0–5.0, default 2.5 (exponent)
│   ├── mid-transition noise — 0.0–1.0, default 0.4
│   └── edge softness        — 0.0–1.0, default 0.5
├── Post-Processing
│   ├── bloom strength       — 0.0–2.0, default 0.7
│   ├── bloom radius         — 0.0–1.0, default 0.4
│   ├── vignette             — 0.0–1.0, default 0.3
│   └── color temperature    — -1.0–1.0, default 0.0 (warm/cool shift)
└── Debug
    ├── show noise only      — boolean
    ├── show displacement    — boolean
    ├── freeze progress      — boolean + manual slider
    └── frame rate overlay   — boolean
```

**Leva visibility:**
- `?controls=true` query param or `VITE_SHOW_CONTROLS=true` env var → show leva panel
- Production/kiosk: hidden by default
- Keyboard shortcut: `Ctrl+Shift+L` toggles leva panel

---

## D. System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        BROWSER (Kiosk / Chrome)                     │
│                                                                     │
│  ┌───────────────┐              ┌────────────────────────────────┐  │
│  │  /input        │              │  /wall                         │  │
│  │                │              │                                │  │
│  │  [Mic Button]  │   Firestore  │  ┌──────────────────────────┐ │  │
│  │  Web Speech    │◄────────────►│  │  WebGL StreamDiffusion   │ │  │
│  │  API → text    │   realtime   │  │  Morph Canvas            │ │  │
│  │  Submit        │   listener   │  │  + leva controls         │ │  │
│  └──────┬────────┘              │  └──────────────────────────┘ │  │
│         │                        │                                │  │
│         │ POST /api/vision       └────────────────────────────────┘  │
│         ▼                                                           │
└─────────┼───────────────────────────────────────────────────────────┘
          │ HTTPS
          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  FIREBASE CLOUD FUNCTIONS                            │
│                                                                     │
│  POST /api/vision                                                   │
│    1. Receive transcript text                                       │
│    2. HF Inference → Groq/Mistral LLM → enrich to image prompt     │
│       (style guardrail system prompt enforces composition/palette)  │
│    3. HF Inference → FLUX.1-schnell img2img from base → generate   │
│    4. Upload PNG to Firebase Storage                                │
│    5. Write vision doc to Firestore (triggers realtime listener)    │
│                                                                     │
│  POST /api/vision/interpolate (Tier 2 enhancement)                  │
│    → Generate 4-8 intermediate frames via sequential img2img        │
│    → Upload to Storage, update Firestore with frame URLs            │
│                                                                     │
│  GET /api/visions                                                   │
│    → List all generated vision image URLs from Firestore            │
│                                                                     │
│  GET /api/health                                                    │
│    → Health check: { ok, hfApi, firebase }                          │
└─────────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
Voice Input → Web Speech API → transcript (string)
  → POST /api/vision { text }
  → Cloud Function:
      → HF Inference (Groq/Llama 3): transcript → enriched image prompt
         System prompt enforces:
           - Singapore waterfront composition (water, buildings, supertrees, sky)
           - Watercolour aesthetic matching base-img.png (palette derived from existing prototype)
           - Calm/hopeful mood
           - 1680x720 panoramic format
      → HF Inference (FLUX.1-schnell): img2img(base-img.png, prompt, strength=0.4)
         (if img2img unavailable on provider, fall back to txt2img with detailed composition prompt)
         → generated PNG (1680x720)
      → Firebase Storage: upload PNG
      → Firestore: write { id, imageUrl, prompt, transcript, createdAt }
  → Wall page (Firestore onSnapshot listener):
      → Receives new vision doc
      → Downloads image, preloads into WebGL texture
      → Queues for StreamDiffusion morph transition
      → Shader begins progressive noise → blend → denoise cycle
```

### Folder Structure

```
the-future-wall-sd/
├── public/
│   ├── assets/
│   │   ├── textures/
│   │   │   └── base-img.png              # Base composition reference (copied)
│   │   ├── dreams/                        # Pre-generated idle images (6+)
│   │   └── noise/                         # Noise textures for shader
│   └── favicon.ico
├── src/
│   ├── components/
│   │   ├── atoms/
│   │   │   ├── MicButton/
│   │   │   │   ├── index.js
│   │   │   │   ├── MicButton.jsx
│   │   │   │   └── MicButton.module.css
│   │   │   └── StatusIndicator/
│   │   │       ├── index.js
│   │   │       ├── StatusIndicator.jsx
│   │   │       └── StatusIndicator.module.css
│   │   ├── molecules/
│   │   │   └── TranscriptDisplay/
│   │   │       ├── index.js
│   │   │       ├── TranscriptDisplay.jsx
│   │   │       └── TranscriptDisplay.module.css
│   │   ├── organisms/
│   │   │   ├── VoiceCapture/
│   │   │   │   ├── index.js
│   │   │   │   ├── VoiceCapture.jsx
│   │   │   │   └── VoiceCapture.module.css
│   │   │   └── MorphCanvas/
│   │   │       ├── index.js
│   │   │       ├── MorphCanvas.jsx
│   │   │       ├── MorphCanvas.module.css
│   │   │       ├── morphShader.js         # GLSL StreamDiffusion fragment shader
│   │   │       └── useLevaControls.js     # Leva control definitions
│   │   └── pages/
│   │       ├── InputPage/
│   │       │   ├── index.js
│   │       │   └── InputPage.jsx
│   │       └── WallPage/
│   │           ├── index.js
│   │           └── WallPage.jsx
│   ├── hooks/
│   │   ├── useSpeechRecognition.js        # Web Speech API wrapper
│   │   ├── useVisionListener.js           # Firestore onSnapshot subscription
│   │   ├── useVisionCycle.js              # Image queue + morph timing
│   │   └── useIdleTimeout.js              # Return to idle after inactivity
│   ├── services/
│   │   ├── api.js                         # Fetch wrapper for Cloud Functions
│   │   ├── firebase.js                    # Firebase app init + Firestore + Storage
│   │   └── visionService.js               # submitVision(), getVisions()
│   ├── stores/
│   │   └── useWallStore.js                # Zustand: FSM, vision queue, morph state
│   ├── styles/
│   │   ├── tokens.css                     # Design tokens (base-img palette)
│   │   └── global.css                     # Reset + base styles
│   ├── config/
│   │   └── index.js                       # Timing, prompts, defaults, leva presets
│   ├── utils/
│   │   └── imageLoader.js                 # Preload + cache images as textures
│   ├── App.jsx
│   └── main.jsx
├── functions/
│   ├── index.js                           # Cloud Functions entry
│   ├── routes/
│   │   └── vision.js                      # Vision API route handlers
│   ├── services/
│   │   ├── promptEnricher.js              # HF Inference → LLM prompt enrichment
│   │   ├── imageGenerator.js              # HF Inference → image generation
│   │   └── styleGuardrails.js             # System prompt + composition rules
│   ├── config.js                          # Server config
│   └── package.json                       # Functions-specific dependencies
├── scripts/
│   ├── generate-dreams.mjs                # Pre-generate idle dream images via HF API
│   └── copy-base-image.sh                 # Copy base-img from sister project
├── spec/
│   └── technical-blueprint.md             # This document
├── docs/
│   ├── adr/                               # Architecture Decision Records
│   └── setup.md                           # Local + Firebase setup guide
├── e2e/
│   └── flow.spec.js                       # Playwright E2E test
├── .env.example
├── .firebaserc
├── firebase.json
├── .gitignore
├── .eslintrc.json
├── .prettierrc
├── index.html
├── package.json
├── vite.config.js
├── playwright.config.js
├── CLAUDE.md
└── README.md
```

---

## E. Implementation Plan

### Phase 1: Scaffold + Static Flow (Day 1)

1. Initialize project: `pnpm create vite the-future-wall-sd --template react`
2. Install deps: `react-router`, `zustand`, `leva`, `firebase`
3. Create folder structure per spec
4. Set up design tokens matching base-img palette
5. Create `config/index.js` with all timing + API constants + leva defaults
6. Set up React Router: `/input`, `/wall`, `/` → redirect to `/wall`
7. Build `MicButton` atom (visual states, CSS animation — idle pulse, recording glow, processing spin)
8. Build `InputPage` with static layout
9. Build `WallPage` displaying base-img.png as static fullscreen image
10. Set up Firebase project (`firebase init` — Hosting + Functions + Firestore + Storage)
11. Deploy empty shell to Firebase Hosting

### Phase 2: Voice Capture + Prompt Pipeline (Day 2)

1. Implement `useSpeechRecognition` hook (Web Speech API)
2. Wire `MicButton` → live transcript display → submit
3. Build `TranscriptDisplay` molecule
4. Build `VoiceCapture` organism (compose mic + transcript + submit)
5. Create Cloud Function `POST /api/vision` (echo transcript back for now)
6. Implement `promptEnricher.js` — HF Inference API → Groq/Llama 3
7. Write `styleGuardrails.js` — system prompt enforcing composition, palette, mood
8. Test: transcript → enriched prompt (via `curl` to deployed function)

### Phase 3: Image Generation (Day 2–3)

1. Implement `imageGenerator.js` — HF Inference API → FLUX.1-schnell (or SDXL Turbo)
2. Configure img2img: base-img.png as init image, denoise strength 0.35–0.50
3. Upload generated PNG to Firebase Storage, write metadata to Firestore
4. Set up `firebase.js` client-side init
5. Implement `useVisionListener.js` — Firestore `onSnapshot` for real-time updates
6. Pre-generate 6+ dream images for idle cycling (via `scripts/generate-dreams.mjs`)
7. Copy base-img.png into project (`scripts/copy-base-image.sh`)
8. Test full voice → prompt → image → Firestore pipeline end-to-end

### Phase 4: StreamDiffusion Morph Shader (Day 3–4)

1. Write `morphShader.js` — GLSL fragment shader implementing the 3-phase StreamDiffusion effect:
   - Phase 1: Progressive noise injection on current image
   - Phase 2: Noise-driven per-pixel blend with displacement warping
   - Phase 3: Denoising resolve into next image
2. Build `MorphCanvas` organism — WebGL setup, dual-texture management, uniform updates
3. Implement `useLevaControls.js` — all morph/noise/displacement/post-processing controls
4. Wire leva → shader uniforms (real-time parameter updates)
5. Build `useVisionCycle` hook — image queue, morph timing, preloading
6. Wire Firestore listener → store → MorphCanvas
7. Tune default parameters to match StreamDiffusion visual signature
8. Add `?controls=true` query param for leva panel visibility
9. Test continuous cycling with dream images + leva tuning

### Phase 5: Polish + Kiosk Mode (Day 4–5)

1. Kiosk mode: fullscreen API, cursor hide, idle timeout (60s)
2. Error recovery: Firestore reconnect, generation retry with exponential backoff
3. Offline fallback: dream image cycling if Cloud Functions unreachable
4. Leva presets: save/load named parameter presets for different moods
5. Bloom post-processing pass in WebGL
6. Vignette + color temperature adjustments
7. `Ctrl+Shift+L` keyboard shortcut to toggle leva panel
8. Playwright E2E test
9. Performance profiling (WebGL memory, texture cache eviction)
10. Deploy to Firebase, test on target display resolution
11. Write CLAUDE.md for the project
12. Write setup.md

---

## F. Build Specification

### Routes / Pages

| Route | Component | Purpose |
|-------|-----------|---------|
| `/input` | `InputPage` | Voice capture, transcript display, submission, generation progress |
| `/wall` | `WallPage` | Fullscreen StreamDiffusion morph canvas + leva controls |
| `/` | Redirect → `/wall` | Default to wall display |

### Components

| Component | Level | Key Props | Description |
|-----------|-------|-----------|-------------|
| `MicButton` | Atom | `isRecording`, `isProcessing`, `onPress`, `onRelease` | Large round button with animated states (idle pulse, recording glow, processing spin) |
| `StatusIndicator` | Atom | `status`, `message` | Visual feedback text/icon for current pipeline stage |
| `TranscriptDisplay` | Molecule | `text`, `isLive` | Shows live transcript with typing indicator, fades when submitted |
| `VoiceCapture` | Organism | `onVisionSubmitted` | Composes MicButton + TranscriptDisplay + submit logic + progress |
| `MorphCanvas` | Organism | `images[]`, `levaControls` | WebGL canvas with StreamDiffusion shader + leva-driven uniforms |
| `InputPage` | Page | — | Full input flow with generation progress feedback |
| `WallPage` | Page | — | Fullscreen morph display with optional leva panel |

### API Endpoints (Cloud Functions)

| Method | Path | Request | Response | Description |
|--------|------|---------|----------|-------------|
| `POST` | `/api/vision` | `{ text: string }` | `{ id, status, imageUrl, prompt }` | Submit transcript → enrich → generate → store |
| `GET` | `/api/visions` | `?limit=N` | `[{ id, imageUrl, prompt, createdAt }]` | List generated visions |
| `POST` | `/api/vision/interpolate` | `{ fromId, toId, frames: N }` | `{ id, frameUrls[] }` | Generate interpolation frames (Tier 2) |
| `GET` | `/api/health` | — | `{ ok, hfApi, firestore }` | Health check |

### State Model (Zustand)

```javascript
// stores/useWallStore.js
{
  // Input page FSM
  phase: 'idle' | 'recording' | 'transcribing' | 'enriching' | 'generating' | 'done' | 'error',
  transcript: '',
  enrichedPrompt: '',
  generationProgress: 0,        // 0-100
  lastGeneratedUrl: null,
  errorMessage: null,

  // Wall page
  visionQueue: [],               // [{ id, imageUrl, prompt, createdAt }]
  dreamImages: [],               // Pre-loaded idle cycling images
  currentIndex: 0,
  nextIndex: 1,
  morphProgress: 0,              // 0.0–1.0 (drives shader uProgress)
  isIdle: true,                  // true = cycling dreams, false = visitor vision incoming

  // Actions
  setPhase: (phase) => ...,
  setTranscript: (text) => ...,
  pushVision: (vision) => ...,   // Add to queue, set isIdle=false
  advanceVision: () => ...,      // Move to next in queue
  setMorphProgress: (p) => ...,
  resetToIdle: () => ...,
}
```

### Firestore Schema

```
visions/{visionId}
  ├── transcript: string
  ├── prompt: string
  ├── imageUrl: string           # Firebase Storage download URL
  ├── status: 'generating' | 'complete' | 'error'
  ├── createdAt: timestamp
  └── frames?: string[]          # Optional: interpolation frame URLs (Tier 2)
```

### Environment Variables

```env
# .env.example — Client (Vite)
VITE_FIREBASE_API_KEY=<firebase-api-key>
VITE_FIREBASE_AUTH_DOMAIN=<project>.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=<project-id>
VITE_FIREBASE_STORAGE_BUCKET=<project>.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=<sender-id>
VITE_FIREBASE_APP_ID=<app-id>
VITE_API_BASE=https://<region>-<project>.cloudfunctions.net
VITE_ASPECT_RATIO=2.33
VITE_SHOW_CONTROLS=false

# functions/.env — Cloud Functions
HF_TOKEN=<huggingface-api-token>           # Free credits ($0.10/month)
HF_IMAGE_MODEL=black-forest-labs/FLUX.1-schnell  # Validate availability on chosen provider
HF_LLM_MODEL=meta-llama/Llama-3.1-8B-Instruct   # Or whichever model is available via chosen provider
HF_LLM_PROVIDER=groq                             # Validate Groq availability on HF free credits
IMAGE_WIDTH=1680
IMAGE_HEIGHT=720
IMAGE_STRENGTH=0.4
FIREBASE_STORAGE_BUCKET=<project>.appspot.com
```

### External Services (All Free Tier)

| Service | Purpose | Auth | Free Limits |
|---------|---------|------|-------------|
| **Firebase Hosting** | Static frontend | Firebase project | Spark plan (verify limits) |
| **Cloud Functions** | Backend API | Firebase project | Spark plan (verify limits) |
| **Firebase Storage** | Image storage | Firebase project | Spark plan (verify limits) |
| **Firestore** | Vision metadata + realtime sync | Firebase project | Spark plan (verify limits) |
| **HF Inference API** | Image generation | HF token (free) | $0.10/month free credits |
| **HF Inference API** | LLM prompt enrichment | HF token (free) | $0.10/month free credits (shared) |
| **Web Speech API** | Browser STT | None | Unlimited |

---

## G. Technical Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| HF free credits ($0.10/month) exhausted during demo | Generation fails | Pre-generate pool of 20+ images before demo day. Cycle pre-generated images when credits are spent. Queue submissions. |
| Image generation too slow for interactive feel | Breaks interactive feel | Show rich progress feedback. Try faster few-step models (SDXL Turbo, FLUX-schnell). Consider Pollinations.ai (zero-auth). Benchmark early in Phase 3. |
| Generated images drift from base composition | Wall looks inconsistent | Style guardrail system prompt + img2img from base (not txt2img). Denoise strength capped at 0.5. |
| Web Speech API unreliable on kiosk browser | Input fails | Fallback to typed text input. Test on target browser/OS early. |
| WebGL shader performance on kiosk PC | Janky transitions | Profile early. Reduce noise resolution. Offer "simple blend" fallback mode via leva. |
| Cloud Functions cold start latency | First request slow (varies — seconds to tens of seconds depending on function size) | Use `minInstances: 1` (not available on Spark plan) or accept cold start for prototype. Warm function with periodic health check. |
| Firebase free tier exhausted during sustained demo | Service down | Monitor usage. Pre-generate images for demo day. Implement local fallback mode with pre-loaded assets. |
| StreamDiffusion shader doesn't match client expectation | Client rejects animation | Leva controls allow real-time tuning during client review. Save multiple presets. Record video captures of different settings. |

---

## H. Recommendation

### Final Stack

**React + Vite + Firebase (Hosting + Functions + Firestore + Storage) + HF Inference API (free credits) + WebGL StreamDiffusion shader + leva**

This is the best fit because:

1. **Matches KR+D standards** — React+Vite+Zustand is the documented stack. No learning curve.
2. **All free for prototype** — Only requires a HF token (free registration, $0.10/month credits) and Firebase project (free Spark plan). Sufficient for development and small demos; pre-generate images for larger demo sessions.
3. **Firebase is proven** — The original `the-future-wall` had Firebase Cloud Functions (now archived). Restoring this path is natural. Firestore realtime listeners replace the custom SSE implementation with zero server code.
4. **StreamDiffusion shader is tuneable** — Leva controls make the transition effect fully adjustable during client demos. This is critical for getting animation/styling approved.
5. **Progressive enhancement** — Tier 1 (shader-only) works without any server. Tier 2 (interpolation frames) adds authenticity when server is available. Demo mode works fully offline with pre-generated dreams.
6. **Deployable immediately** — `firebase deploy` gets a public URL for client review in minutes.

### What to Mock First vs Build Fully

| Component | Start With | Build Fully When |
|-----------|-----------|-----------------|
| Speech-to-text | Web Speech API (real — it's free) | Already real |
| Prompt enrichment | Hardcoded template with `{transcript}` slot | HF token is configured |
| Image generation | Pre-generated images cycled on submit | HF Inference API is working |
| StreamDiffusion shader | CSS opacity crossfade + noise overlay | After image pipeline works |
| Firestore realtime | Polling `/api/visions` | After Firebase project is set up |
| Leva controls | Hardcoded defaults | After shader is functional |
| Interpolation frames (Tier 2) | Skip entirely for MVP | After Tier 1 shader is approved |

---

## I. Execution Checklist

```
Phase 1: Scaffold
  [ ] pnpm create vite the-future-wall-sd --template react
  [ ] pnpm add react-router zustand leva firebase
  [ ] Create folder structure per Section D
  [ ] Copy base-img.png from ../the-future-wall/public/assets/textures/
  [ ] Set up design tokens (tokens.css) — palette sampled from base-img.png
  [ ] Create config/index.js — timing, API, leva defaults
  [ ] Set up React Router: /input, /wall
  [ ] Build MicButton atom (3 visual states, CSS animation)
  [ ] Build InputPage shell
  [ ] Build WallPage shell (static base-img.png fullscreen)
  [ ] firebase init (Hosting + Functions + Firestore + Storage)
  [ ] firebase deploy — verify empty shell is live

Phase 2: Voice Pipeline
  [ ] Implement useSpeechRecognition hook
  [ ] Wire MicButton → transcript → TranscriptDisplay
  [ ] Build VoiceCapture organism
  [ ] Create Cloud Function: POST /api/vision (echo)
  [ ] Implement promptEnricher.js (HF Inference → Groq LLM)
  [ ] Write styleGuardrails.js (system prompt)
  [ ] Deploy functions, test transcript → prompt via curl

Phase 3: Image Generation
  [ ] Implement imageGenerator.js (HF Inference → FLUX.1-schnell)
  [ ] Configure img2img with base-img.png init
  [ ] Wire: prompt → generate → Firebase Storage → Firestore doc
  [ ] Implement firebase.js client init
  [ ] Implement useVisionListener.js (Firestore onSnapshot)
  [ ] Pre-generate 6+ dream images (scripts/generate-dreams.mjs)
  [ ] Test full pipeline: speak → image → Firestore → wall receives

Phase 4: StreamDiffusion Shader
  [ ] Write morphShader.js (GLSL 3-phase StreamDiffusion)
  [ ] Build MorphCanvas (WebGL setup, dual textures, uniforms)
  [ ] Implement useLevaControls.js (all parameter groups)
  [ ] Wire leva → shader uniforms
  [ ] Build useVisionCycle (queue, timing, preloading)
  [ ] Wire Firestore → store → MorphCanvas
  [ ] Tune defaults to match StreamDiffusion visual signature
  [ ] Test: continuous dream cycling + visitor interruption
  [ ] Record video of effect for client review

Phase 5: Polish
  [ ] Kiosk mode (fullscreen, no cursor, idle timeout 60s)
  [ ] Error recovery (Firestore reconnect, gen retry)
  [ ] Offline fallback (dream cycling without server)
  [ ] Bloom + vignette post-processing
  [ ] Leva presets (save/load)
  [ ] Ctrl+Shift+L toggle for leva panel
  [ ] Playwright E2E test
  [ ] Performance profiling
  [ ] Deploy to Firebase, test on 1680x720 display
  [ ] Write CLAUDE.md
  [ ] Write docs/setup.md
```

---

## J. Recommended Libraries

| Library | Version | Purpose |
|---------|---------|---------|
| `react` + `react-dom` | latest stable | UI framework |
| `react-router` | latest stable | Client routing (/input, /wall) |
| `zustand` | latest stable | State management (FSM, vision queue) |
| `leva` | latest stable | Real-time GUI controls for shader tuning |
| `vite` | latest stable | Build tool + dev server |
| `firebase` | latest stable | Client SDK (Firestore, Storage) |
| `firebase-admin` | latest stable | Server SDK (Cloud Functions) |
| `firebase-functions` | latest stable | Cloud Functions framework |
| `@huggingface/inference` | latest stable | HF Inference API client (image gen + LLM) |
| `vitest` | latest stable | Unit tests |
| `@testing-library/react` | latest stable | Component tests |
| `playwright` | latest stable | E2E tests |
| `eslint` + `prettier` | latest stable | Code quality |

> **Note:** Pin exact versions in `package.json` at time of scaffold. "Latest stable" means: run `pnpm add <package>` without a version specifier and let npm resolve the current stable release.

---

## K. Start-Here Implementation Order

This is the sequential order for building the prototype, with each step producing a testable result:

```
 1. pnpm create vite + install deps + folder structure
    → Runnable empty app at localhost:5173

 2. React Router + InputPage + WallPage shells
    → Two navigable pages with placeholder content

 3. MicButton + useSpeechRecognition
    → Press button, see live transcript in browser (real STT working)

 4. Firebase init + deploy empty shell
    → Live URL on Firebase Hosting

 5. Cloud Function POST /api/vision (echo mode)
    → Submit transcript from InputPage, get response

 6. promptEnricher.js + styleGuardrails.js
    → Transcript → enriched prompt with composition rules (test via curl)

 7. imageGenerator.js (HF Inference → FLUX.1-schnell img2img)
    → Prompt → generated PNG in Firebase Storage (test via curl)

 8. Full pipeline wired end-to-end
    → Speak → transcript → prompt → image → Firestore doc

 9. useVisionListener + WallPage displays latest image
    → Static image swap when new vision arrives (no transition yet)

10. morphShader.js (GLSL StreamDiffusion 3-phase shader)
    → WebGL canvas with hardcoded test transition between two images

11. useLevaControls + wire to shader
    → Real-time parameter adjustment of transition effect

12. MorphCanvas + useVisionCycle + dream images
    → Continuous idle morphing through pre-generated dreams

13. Wire everything: Firestore → store → MorphCanvas
    → Full experience: voice → image → StreamDiffusion morph on wall

14. Kiosk mode + error recovery + polish
    → Production-ready prototype for client demo
```

**Steps 1–4:** Can use fully mocked data. Focus on skeleton and deployment pipeline.
**Steps 5–7:** Can be tested independently via `curl`. Focus on API correctness.
**Step 8:** First end-to-end moment. Key milestone.
**Steps 10–11:** The StreamDiffusion shader is the client-facing deliverable. Spend time here tuning with leva.
**Step 13:** Full experience integration. Second key milestone.
**Step 14:** Polish for demo day.
