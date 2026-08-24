import { describe, it, expect } from "vitest";
import { assertNoNamedProducts } from "../guardrails";

describe("assertNoNamedProducts", () => {
  it("does not throw on clean category-level prose", () => {
    expect(() =>
      assertNoNamedProducts(
        "Classification works because incoming requests need to be sorted into one of several predefined categories.",
        "test"
      )
    ).not.toThrow();
  });

  it.each([
    "Use ChatGPT to draft the first pass.",
    "A GPT-4 model would work well here.",
    "This is a good fit for Claude.",
    "Try Google's Gemini for this.",
    "Microsoft Copilot can help draft this.",
    "An open-source Llama model would work.",
    "Groq can serve this at low latency.",
    "Mistral is well-suited to this task.",
  ])("throws when the text names a product: %s", (text) => {
    expect(() => assertNoNamedProducts(text, "test")).toThrow(/named a specific product/i);
  });

  it("does not flag a client's own existing, non-AI tooling", () => {
    // A legitimate reveal can reference systems the client already has —
    // this must not be confused with recommending an AI product.
    expect(() =>
      assertNoNamedProducts(
        "The client's support tickets already live in their CRM and just need routing.",
        "test"
      )
    ).not.toThrow();
  });

  it("includes the matched term and the field label in the error message", () => {
    expect(() => assertNoNamedProducts("Use ChatGPT here.", "reveal.whyItFits")).toThrow(
      /reveal\.whyItFits/
    );
  });
});
