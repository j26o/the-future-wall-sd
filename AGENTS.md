# The Future Wall SD — Agent Patterns

> Project-specific agent workflows.
> Parent patterns: see root `AGENTS.md` in the KR+D repo for the 4-agent pipeline, prompt templates, and Claude Code subagent patterns.
> Decisions: see [`DECISIONS.md`](DECISIONS.md) for architectural choices.

## Project-Specific Agents

### Ink-Wash Shader Agent

**When:** Adjusting the ink-wash composite post-processing (desaturation, fog, volumetric light, halation, grain, vignette).
**Type:** Claude Code (general-purpose)
**Prompt pattern:**
```
Read the composite shader at src/components/organisms/MorphCanvas/morphShader.js
and the leva controls at useLevaControls.js. Defaults are in
src/config/index.js under LEVA_DEFAULTS.

Task: [describe the visual change needed]

Constraints:
- Shader is post-processing only — diffusion frames come from inference server
- All new parameters must be added as uniforms + leva controls
- Test that pnpm build succeeds after changes
```

### Inference Server Agent

**When:** Modifying the local diffusion inference server (model, endpoints, performance).
**Type:** Claude Code (general-purpose)
**Prompt pattern:**
```
Read inference-server/server.py and src/services/inferenceService.js.
The server runs sd-turbo via diffusers on MPS/CUDA (see DECISIONS.md D015).

Task: [describe the change needed]

Constraints:
- Keep API compatible with inferenceService.js client
- Test endpoints via curl or the /health check
- MPS and CUDA paths must both work
```

### Vision Pipeline Debug Agent

**When:** Investigating why generated images look wrong or the pipeline fails.
**Type:** Claude Code (Explore)
**Prompt pattern:**
```
Trace the vision pipeline from submission to display:
1. VoiceCapture.jsx handleSubmit → services/visionService.js
2. functions/routes/vision.js → promptEnricher → imageGenerator
3. Style guardrails in functions/services/styleGuardrails.js
4. Firestore write → useVisionListener.js → useWallStore pushVision

Investigate: [describe the symptom]
Check: prompt enrichment output, img2img parameters, error handling at each step
```

### E2E Test Agent

**When:** Adding new pages or features that need test coverage.
**Type:** Claude Code (general-purpose)
**Prompt pattern:**
```
Read the existing Playwright tests in e2e/ and playwright.config.js.
Tests run against the Vite preview server (port 4173) per DECISIONS.md D011.

Add tests for: [describe feature]

Conventions:
- Mock API calls with page.route() (no backend running during tests)
- Use semantic selectors (aria-label, role, text content) over CSS classes
- Group in test.describe() by page/feature
- Run pnpm build && pnpm test:e2e to verify
```

## Agent Routing for This Project

| Task | Agent / Tool | Notes |
|------|-------------|-------|
| Modify ink-wash shader | Claude Code | Read morphShader.js + MorphCanvas.jsx first |
| Inference server changes | Claude Code | Read server.py + inferenceService.js |
| Add new page/component | Claude Code | Follow Atomic Design, add barrel export |
| Debug voice pipeline | Claude Code (Explore) | Trace across client + Cloud Functions |
| Review image quality | Gemini | See GEMINI.md shader tuning workflow |
| Compare design vs implementation | Gemini | Screenshot comparison |
| Add/update tests | Claude Code | Playwright e2e, mock APIs |
| Cloud Functions changes | Claude Code | Test with firebase emulators |
