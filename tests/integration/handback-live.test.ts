import { describe, it, expect } from "vitest";
import { generateHandback } from "@/lib/engine/handback";

// ---------------------------------------------------------------------------
// A live, unmocked call to Groq exercising the actual `generateHandback`
// production code path with `openai/gpt-oss-120b`. Task 13 review flagged
// that the handback model swap (from the retired llama-3.3-70b-versatile)
// had zero verification: no test asserts the model string, and the
// guess-then-reveal integration test stops at reveal, never reaching
// handback. This closes that gap. Costs one real API call, so it is gated
// behind INTEGRATION=1 like the rest of the integration suite.
//
// Run: INTEGRATION=1 npx vitest run tests/integration/handback-live.test.ts
// ---------------------------------------------------------------------------

const RUN = process.env.INTEGRATION === "1";

describe.skipIf(!RUN)("generateHandback (real Groq)", () => {
  it("produces a sensible, non-empty client-facing draft for a realistic input", async () => {
    if (!process.env.GROQ_API_KEY) {
      throw new Error("GROQ_API_KEY is required to run this integration test");
    }

    const input = {
      goal: "Reduce customer churn by identifying at-risk accounts before they cancel",
      problemType:
        "Predict which customers are likely to cancel their subscription in the next 30 days",
      revealedCategory: "Prediction",
    };

    const text = await generateHandback(input);

    // Deliberately surfaced so the real response is visible in CI/console
    // output for this one-off check.
    console.log("[handback-live] response:", text);

    expect(text.trim().length).toBeGreaterThan(0);
    // Sanity bound on a "3-5 sentence" draft — catches wildly truncated or
    // runaway output without being a brittle exact-length assertion.
    expect(text.length).toBeLessThan(2000);
    // Product/vendor/model names are explicitly forbidden by the prompt.
    expect(text).not.toMatch(/openai|anthropic|groq|gpt|claude|llama/i);
  });
});
