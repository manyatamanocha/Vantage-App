import { getGroqClient } from "@/lib/groq";
import { withRetry } from "./with-retry";
import { parseJsonResponse } from "./parse-json-response";
import { checkFinishReason } from "./check-finish-reason";
import { assertNoNamedProducts } from "./guardrails";
import { CATEGORY_TAXONOMY, isCategory, type Category } from "./taxonomy";

/**
 * The shared category-level recommendation engine. Both loops run through here:
 * the reactive solve flow (Task 7) and the daily practice loop, which reuses
 * this exact function rather than a second prompt.
 */
export type RevealResult = {
  match: boolean;
  revealedCategory: Category;
  whyItFits: string;
  whyNotAlternatives: { category: Category; reason: string }[];
  toolClass: "general-purpose" | "specialized";
};

const TOOL_CLASSES = ["general-purpose", "specialized"] as const;

// Groq's JSON mode requires the word "JSON" to appear in the messages — it is in
// this system prompt, which is sent on every call.
const SYSTEM_PROMPT = `You are Vantage's recommendation engine. A consultant has described a client's problem and has already committed to a guess about which kind of AI approach it needs. Your job is to reveal the right approach and teach them why the alternatives they might have reached for do not fit THIS problem.

Choose "revealedCategory" from this fixed list, copied verbatim, and nothing else: ${CATEGORY_TAXONOMY.join(", ")}.

Rules:
1. Never name a product, vendor, model, library, or tool. Recommendations are category-level plus a tool class only. Every "category" value you emit must be one of the categories listed above.
2. "toolClass" is "general-purpose" when a general-purpose AI assistant, working from a prompt and whatever material is pasted into it, can carry this problem. It is "specialized" when the problem needs a purpose-built system of its own — its own data pipeline, retrieval over the client's corpus, a trained model, or domain tooling.
3. "whyItFits" is one or two sentences that point at concrete specifics of THIS client's problem: the material they actually have, the decision they actually need, the shape of the output they actually want. It is not a definition of the category.
4. "whyNotAlternatives" covers the 1-3 other categories from the list that a thoughtful person would most plausibly have picked for THIS problem. If the consultant's guess is not the revealed category, their guess MUST be the first entry. Each "reason" is a comparison against this specific problem — name the thing this problem has, or lacks, that rules that category out. A reason that would read identically for some other client's problem is wrong. Never give the definition of a category as its reason, and never repeat the revealed category here.
5. "match" is true only when the consultant's guess is exactly the revealed category.

Respond with ONLY a JSON object in this shape — no prose, no markdown fences:
{"match": boolean, "revealedCategory": string, "whyItFits": string, "whyNotAlternatives": [{"category": string, "reason": string}], "toolClass": "general-purpose" | "specialized"}`;

/** The raw shape the model is asked for, before taxonomy checks are applied. */
type RawReveal = {
  match: boolean;
  revealedCategory: string;
  whyItFits: string;
  whyNotAlternatives: { category: string; reason: string }[];
  toolClass: "general-purpose" | "specialized";
};

function isRawReveal(parsed: unknown): parsed is RawReveal {
  if (typeof parsed !== "object" || parsed === null) return false;
  const candidate = parsed as Partial<RawReveal>;
  return (
    typeof candidate.match === "boolean" &&
    typeof candidate.revealedCategory === "string" &&
    typeof candidate.whyItFits === "string" &&
    Array.isArray(candidate.whyNotAlternatives) &&
    candidate.whyNotAlternatives.every(
      (alternative) =>
        typeof alternative === "object" &&
        alternative !== null &&
        typeof alternative.category === "string" &&
        typeof alternative.reason === "string"
    ) &&
    (TOOL_CLASSES as readonly string[]).includes(candidate.toolClass as string)
  );
}

export async function recommendCategory(input: {
  goal: string;
  problemType: string;
  guessedCategory: string;
}): Promise<RevealResult> {
  const client = getGroqClient();
  const userContent = `Goal: ${input.goal}\nProblem type: ${input.problemType}\nUser's guess: ${input.guessedCategory}`;

  const response = await withRetry((signal) =>
    client.chat.completions.create(
      {
        model: "openai/gpt-oss-120b",
        // openai/gpt-oss-120b is a reasoning model: its reasoning tokens draw
        // from this same completion-token budget. "low" keeps reasoning
        // bounded for this task, and max_tokens is sized generously above
        // that — this is the most output-heavy of the three call sites
        // (multiple alternatives plus prose reasons) — since these are cheap
        // free-tier calls, not a cost concern for an MVP.
        reasoning_effort: "low",
        max_tokens: 2000,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
      },
      // withRetry is the single retry + timeout layer: disable the SDK's own
      // retries and let the outer timeout abort the in-flight request.
      { maxRetries: 0, signal }
    )
  );

  checkFinishReason(response.choices[0]?.finish_reason, "reveal");

  const text = response.choices[0]?.message?.content ?? "";
  const parsed = parseJsonResponse(text, isRawReveal, "reveal");

  if (!isCategory(parsed.revealedCategory)) {
    throw new Error(
      `Model returned a category outside the taxonomy: ${parsed.revealedCategory}`
    );
  }
  const revealedCategory = parsed.revealedCategory;

  // Anything that isn't a taxonomy category is a named product or an invention,
  // both of which the plan forbids surfacing; an "alternative" that restates the
  // revealed category teaches nothing.
  const whyNotAlternatives = parsed.whyNotAlternatives
    .filter(
      (alternative) =>
        isCategory(alternative.category) &&
        alternative.category !== revealedCategory
    )
    .map((alternative) => ({
      category: alternative.category as Category,
      reason: alternative.reason,
    }));

  if (whyNotAlternatives.length === 0) {
    throw new Error(
      "Model returned no usable alternative categories to compare against"
    );
  }

  // Taxonomy filtering above catches an off-list category; it does not catch
  // a product name slipped into otherwise-valid prose, which the rule in the
  // system prompt forbids but cannot enforce by itself.
  assertNoNamedProducts(parsed.whyItFits, "reveal.whyItFits");
  for (const alternative of whyNotAlternatives) {
    assertNoNamedProducts(alternative.reason, "reveal.whyNotAlternatives.reason");
  }

  return {
    // Derived, not taken from the model: this drives the persisted `correct`
    // flag and the user's whole progress record, so it cannot depend on the
    // model agreeing with its own revealed category.
    match: revealedCategory === input.guessedCategory,
    revealedCategory,
    whyItFits: parsed.whyItFits,
    whyNotAlternatives,
    toolClass: parsed.toolClass,
  };
}
