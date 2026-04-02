# The Future Wall SD — Agent Patterns

> Project-specific agent workflows.
> Parent patterns: see root `AGENTS.md` in the KR+D repo for the 4-agent pipeline, prompt templates, and Claude Code subagent patterns.
> Decisions: see [`DECISIONS.md`](DECISIONS.md) for architectural choices.

## Project-Specific Agents

### Shader Tuning Agent

**When:** Adjusting leva defaults or adding new shader effects.
**Type:** Claude Code (general-purpose)
**Prompt pattern:**
```
Read the morph shader at src/components/organisms/MorphCanvas/morphShader.js
and the leva controls at useLevaControls.js. The current leva defaults are
in src/config/index.js under LEVA_DEFAULTS.

Task: [describe the visual change needed]

Constraints:
- Keep the shader single-pass (no framebuffers) per DECISIONS.md D007
- Use hash-based noise only (no texture samplers) per D006
- All new parameters must be added as uniforms + leva controls
- Test that pnpm build succeeds after changes
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
| Modify shader effect | Claude Code | Read morphShader.js + MorphCanvas.jsx first |
| Add new page/component | Claude Code | Follow Atomic Design, add barrel export |
| Debug voice pipeline | Claude Code (Explore) | Trace across client + Cloud Functions |
| Review image quality | Gemini | See GEMINI.md shader tuning workflow |
| Compare design vs implementation | Gemini | Screenshot comparison |
| Add/update tests | Claude Code | Playwright e2e, mock APIs |
| Cloud Functions changes | Claude Code | Test with firebase emulators |
