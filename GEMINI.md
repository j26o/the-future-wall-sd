# The Future Wall SD — Gemini Context

> Guidelines for using Gemini with this project.
> Parent workflows: see root `GEMINI.md` in the KR+D repo for Figma-to-code, visual QA, and multimodal prompt patterns.
> Decisions: see [`DECISIONS.md`](DECISIONS.md) for architectural choices.

## When to Use Gemini on This Project

| Task | What to provide | Expected output |
|------|-----------------|-----------------|
| Evaluate shader output quality | Screenshot of morph transition mid-progress | Visual assessment: does it look like StreamDiffusion? Specific feedback on noise, blend quality, color coherence |
| Compare generated image vs base composition | base-img.png + generated vision side by side | Composition fidelity check: is the waterfront layout preserved? Palette drift? |
| Review input page layout from screenshot | InputPage screenshot at kiosk resolution (1920x1080) | Touch target sizing, text readability, layout balance, WCAG contrast |
| Analyze dream images for style consistency | All 6 dream images from `public/assets/dreams/` | Palette consistency, watercolour style adherence, composition alignment with base-img.png |

## Shader Tuning Workflow

When tuning the StreamDiffusion shader effect with Gemini:

1. Capture screenshots at key morph progress values (0.0, 0.15, 0.3, 0.5, 0.7, 0.85, 1.0)
2. Send all 7 screenshots to Gemini with:
```
These are frames from a StreamDiffusion-style morph transition at progress
values 0.0 through 1.0. The effect should look like progressive denoising:
- Phase 1 (0.0-0.3): Current image gains noise + displacement
- Phase 2 (0.3-0.7): Noisy per-pixel blend between images
- Phase 3 (0.7-1.0): Noise recedes, next image resolves cleanly

Assess: noise distribution, blend naturalness, color coherence at
transitions, bloom quality on bright areas, vignette balance.
Suggest leva parameter adjustments if any phase looks off.
```

## Style Guardrail Validation

When reviewing prompt enrichment output:
```
Compare the original visitor transcript and the enriched image prompt.
Verify the enriched prompt:
1. Preserves the visitor's core idea
2. Adds Singapore waterfront, panoramic, watercolour style descriptors
3. Uses the navy/teal/gold palette language
4. Does not introduce inappropriate or off-brand elements
```

## Data Privacy

See root `GEMINI.md` for full policy. Project-specific:
- Do not upload generated images that contain visible visitor transcripts
- Base-img.png is safe to share (generic watercolour, no client IP)
- Dream images are AI-generated, safe to share
