/**
 * Runtime enforcement of "never name a product" — every engine system prompt
 * (reveal.ts, handback.ts) instructs the model not to, but a prompt is a
 * request, not a constraint. Before this, only one integration test
 * (handback-live.test.ts) checked the model actually obeyed, and only for
 * handback's output; reveal's free-text fields (whyItFits, each
 * whyNotAlternatives reason) had no check at all, in code or in a test.
 *
 * Scoped to AI product/vendor/model names specifically, not general company
 * names (e.g. not "Salesforce" or "Google" bare) — those can legitimately
 * appear in a client's own description of their existing, non-AI tooling
 * (structure.ts's output, which feeds into reveal's prompt), and flagging
 * them would throw on a good response for the wrong reason.
 */
const NAMED_PRODUCT_PATTERN = new RegExp(
  [
    "chatgpt",
    "gpt-?\\d",
    "openai",
    "claude",
    "anthropic",
    "gemini",
    "\\bbard\\b",
    "copilot",
    "\\bllama\\b",
    "\\bgroq\\b",
    "mistral",
    "perplexity",
    "midjourney",
    "dall-?e",
    "stable diffusion",
    "\\bwatson\\b",
    "\\bjasper\\b",
    "grammarly",
    "notion ai",
  ].join("|"),
  "i"
);

/**
 * Throws if `text` names a specific AI product, vendor, or model. Call this
 * on every free-text field a model generates that a consultant or their
 * client will actually read — not on fields that just echo the client's own
 * input back (e.g. structure.ts's output), which this would false-positive on.
 */
export function assertNoNamedProducts(text: string, label: string): void {
  const match = text.match(NAMED_PRODUCT_PATTERN);
  if (match) {
    throw new Error(
      `${label} named a specific product ("${match[0]}") — recommendations must stay category-level.`
    );
  }
}
