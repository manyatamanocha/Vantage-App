import { describe, it, expect } from "vitest";
import { recommendCategory } from "@/lib/engine/reveal";
import { CATEGORY_TAXONOMY, type Category } from "@/lib/engine/taxonomy";

// Groq's free tier caps this org at 8000 tokens/minute, and this call site
// alone can request ~2600 (see reveal.ts's max_tokens comment) — so running
// the golden set back-to-back reliably exhausts the budget partway through,
// independent of concurrency. `withRetry`'s single retry (lib/engine/with-retry.ts)
// isn't rate-limit-aware and retries immediately, so it doesn't help here.
// Groq's 429 body includes the actual wait time ("Please try again in Ns");
// honor that instead of guessing, and add a fallback in case a future error
// message doesn't include it.
async function recommendCategoryWithRateLimitRetry(
  ...args: Parameters<typeof recommendCategory>
): ReturnType<typeof recommendCategory> {
  try {
    return await recommendCategory(...args);
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status !== 429) throw err;
    const message = err instanceof Error ? err.message : String(err);
    const match = message.match(/try again in ([\d.]+)s/i);
    const waitMs = match ? Math.ceil(parseFloat(match[1]) * 1000) + 500 : 20000;
    console.log(`[category-accuracy] rate-limited, waiting ${waitMs}ms`);
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    return recommendCategory(...args);
  }
}

// ---------------------------------------------------------------------------
// A golden-set accuracy eval for the shared recommendation engine
// (`recommendCategory`), which both the reactive solve flow and the daily
// practice loop depend on. `guess-then-reveal.test.ts` proves the round trip
// is wired correctly end to end, but never checks whether the model actually
// picks the right category — this closes that gap.
//
// Two hand-labeled examples per taxonomy category (16 total), phrased the way
// a client ask would actually sound rather than as a definition of the
// category, so the eval doesn't just reward the model for pattern-matching a
// textbook description. `goal`/`problemType` are supplied directly (bypassing
// `structureProblem`) to isolate recommendation accuracy from structuring
// accuracy — two different failure modes that would otherwise be conflated.
//
// Costs 16 real Groq calls, so it is gated behind EVAL=1 like the rest of the
// integration suite is gated behind INTEGRATION=1.
//
// Run: EVAL=1 npx vitest run tests/eval/category-accuracy.eval.ts
// ---------------------------------------------------------------------------

const RUN = process.env.EVAL === "1";

type GoldenExample = {
  expectedCategory: Category;
  goal: string;
  problemType: string;
};

const GOLDEN_SET: GoldenExample[] = [
  {
    expectedCategory: "Classification",
    goal: "Route incoming support tickets to the right team automatically",
    problemType:
      "Sort each incoming ticket into billing, technical, or general-inquiry",
  },
  {
    expectedCategory: "Classification",
    goal: "Stop fake reviews from reaching the storefront",
    problemType: "Decide whether each submitted product review is genuine or fake",
  },
  {
    expectedCategory: "RAG",
    goal: "Let customers get accurate answers without waiting for a human agent",
    problemType:
      "Answer customer questions by pulling from our internal policy documents and product manuals",
  },
  {
    expectedCategory: "RAG",
    goal: "Help sales reps answer prospect questions on the spot during calls",
    problemType:
      "Let reps ask a chat assistant questions and get answers sourced from our latest pricing sheets and spec docs",
  },
  {
    expectedCategory: "Prediction",
    goal: "Reduce customer churn by acting before customers leave",
    problemType:
      "Estimate which subscribers are likely to cancel in the next 30 days, based on their usage history",
  },
  {
    expectedCategory: "Prediction",
    goal: "Improve inventory planning for the next quarter",
    problemType:
      "Forecast next quarter's demand for each product line from several years of historical sales data",
  },
  {
    expectedCategory: "Summarization",
    goal: "Give partners a quick read on lengthy analyst reports",
    problemType:
      "Condense long research reports into a short executive brief covering just the key findings",
  },
  {
    expectedCategory: "Summarization",
    goal: "Help managers keep up with support call volume",
    problemType:
      "Produce a one-paragraph digest of each day's customer support call transcripts",
  },
  {
    expectedCategory: "Generation",
    goal: "Speed up the marketing team's first drafts for a product launch",
    problemType:
      "Produce several first-pass marketing copy variations for a new product launch, for the team to edit",
  },
  {
    expectedCategory: "Generation",
    goal: "Make post-call follow-up consistent without adding work for reps",
    problemType:
      "Write a personalized follow-up email draft after each sales call, based on the call notes",
  },
  {
    expectedCategory: "Extraction",
    goal: "Cut down manual data entry from scanned paperwork",
    problemType:
      "Pull key terms — dates, dollar amounts, party names — out of scanned contracts into a spreadsheet",
  },
  {
    expectedCategory: "Extraction",
    goal: "Get invoice data into the accounting system faster",
    problemType:
      "Extract line-item details (item, quantity, unit price) from vendor invoices into structured fields",
  },
  {
    expectedCategory: "Recommendation",
    goal: "Increase upsell revenue per customer",
    problemType:
      "Suggest which additional products to offer each customer, based on what they've already bought",
  },
  {
    expectedCategory: "Recommendation",
    goal: "Keep readers engaged on the site longer",
    problemType:
      "Surface articles a given reader is likely to want next, based on their reading history",
  },
  {
    expectedCategory: "Anomaly Detection",
    goal: "Catch fraudulent transactions before they clear",
    problemType:
      "Flag transactions that look unusual compared to a customer's normal spending pattern",
  },
  {
    expectedCategory: "Anomaly Detection",
    goal: "Catch infrastructure problems before customers notice",
    problemType:
      "Detect abnormal spikes or drops in server error-log volume compared to the recent baseline",
  },
];

// Below this, something is actually broken (a bad prompt change, a taxonomy
// drift) rather than the model's ordinary judgment calls on genuinely
// ambiguous inputs. 12/16 leaves room for a couple of defensible misses
// without masking a real regression.
const MIN_ACCURACY = 0.75;

describe.skipIf(!RUN)("recommendCategory accuracy (real Groq)", () => {
  it(
    `matches the expected category on at least ${Math.round(MIN_ACCURACY * 100)}% of the golden set`,
    { timeout: 300000 }, // 16 sequential calls plus possible rate-limit waits
    async () => {
      if (!process.env.GROQ_API_KEY) {
        throw new Error("GROQ_API_KEY is required to run this eval");
      }

      // Sequential, not Promise.all: firing all 16 calls at once blew through
      // Groq's free-tier rate limit (8000 tokens/minute) in practice. One at
      // a time also matches how the app itself calls Groq — never fanned out.
      const results: (GoldenExample & {
        revealedCategory: Category;
        correct: boolean;
      })[] = [];
      for (const example of GOLDEN_SET) {
        const result = await recommendCategoryWithRateLimitRetry({
          goal: example.goal,
          problemType: example.problemType,
          // Fixed to the expected category rather than varied: this eval
          // isolates the model's category judgment, not the guess/match
          // bookkeeping (which `guess-then-reveal.test.ts` already covers).
          guessedCategory: example.expectedCategory,
        });
        results.push({
          ...example,
          revealedCategory: result.revealedCategory,
          correct: result.revealedCategory === example.expectedCategory,
        });
      }

      const correctCount = results.filter((r) => r.correct).length;
      const accuracy = correctCount / results.length;

      // Deliberately surfaced so per-item results are visible in CI/console
      // output, not just the pass/fail summary.
      console.table(
        results.map((r) => ({
          expected: r.expectedCategory,
          got: r.revealedCategory,
          correct: r.correct,
          problemType: r.problemType,
        }))
      );
      console.log(
        `[category-accuracy] ${correctCount}/${results.length} correct (${(accuracy * 100).toFixed(1)}%)`
      );

      expect(accuracy).toBeGreaterThanOrEqual(MIN_ACCURACY);
    }
  );

  it("covers every taxonomy category at least once", () => {
    const covered = new Set(GOLDEN_SET.map((e) => e.expectedCategory));
    for (const category of CATEGORY_TAXONOMY) {
      expect(covered.has(category)).toBe(true);
    }
  });
});
