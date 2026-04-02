import { InferenceClient } from '@huggingface/inference';
import { HF_TOKEN, HF_LLM_MODEL, HF_LLM_PROVIDER } from '../config.js';
import { STYLE_SYSTEM_PROMPT, buildEnrichmentPrompt } from './styleGuardrails.js';

/**
 * Enrich a visitor's transcript into a detailed image generation prompt
 * using an LLM via the HF Inference API.
 *
 * Falls back to a simple template if HF is unavailable.
 */
export async function enrichPrompt(transcript) {
  if (!HF_TOKEN) {
    console.warn('[promptEnricher] No HF_TOKEN — using template fallback');
    return templateFallback(transcript);
  }

  try {
    const client = new InferenceClient(HF_TOKEN);

    const opts = {
      model: HF_LLM_MODEL,
      messages: [
        { role: 'system', content: STYLE_SYSTEM_PROMPT },
        { role: 'user', content: buildEnrichmentPrompt(transcript) },
      ],
      max_tokens: 300,
      temperature: 0.7,
    };

    if (HF_LLM_PROVIDER) {
      opts.provider = HF_LLM_PROVIDER;
    }

    const response = await client.chatCompletion(opts);
    const prompt = response.choices?.[0]?.message?.content?.trim();

    if (!prompt) {
      console.warn('[promptEnricher] Empty LLM response — using template fallback');
      return templateFallback(transcript);
    }

    return prompt;
  } catch (err) {
    console.error('[promptEnricher] HF API error:', err.message);
    return templateFallback(transcript);
  }
}

function templateFallback(transcript) {
  return (
    `Panoramic watercolour painting of a futuristic Singapore waterfront at night, 1680x720. ` +
    `Deep navy sky with soft prismatic aurora. Teal supertrees and lush vegetation in the middle ground. ` +
    `Calm water with golden reflections in the foreground. ` +
    `${transcript}. ` +
    `Fragile architectural linework, pigment bleed textures, calm hopeful mood.`
  );
}
