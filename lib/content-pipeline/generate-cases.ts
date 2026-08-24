import { getGroqClient } from "@/lib/groq";
import { withRetry } from "@/lib/engine/with-retry";
import { parseJsonResponse } from "@/lib/engine/parse-json-response";
import { checkFinishReason } from "@/lib/engine/check-finish-reason";
import { CATEGORY_TAXONOMY, isCategory, type Category } from "@/lib/engine/taxonomy";

export type Difficulty = "easy" | "medium" | "hard";

export type PracticeCaseCandidate = {
  rawInput: string;
  industry: string;
  intendedCategory: Category;
  difficulty: Difficulty;
};

const DIFFICULTIES: readonly Difficulty[] = ["easy", "medium", "hard"];

function isDifficulty(value: string): value is Difficulty {
  return (DIFFICULTIES as readonly string[]).includes(value);
}

// Groq's JSON mode requires the word "JSON" to appear in the messages — it is
// in this system prompt, which is sent on every call.
//
// Persona framing (non-technical, client-facing professional hearing this in
// a live client meeting, not reading a written case study) matches
// Persona.md / Problem Statement.md in the product vault: she is comfortable
// using AI tools day to day but has never been taught the category-of-approach
// map, so a new client ask gives her nothing to sort it into. Practice
// scenarios exist to build exactly that judgment — see reveal.ts's own
// "consultant" framing for the matching vocabulary at reveal time.
const SYSTEM_PROMPT = `You write short daily-practice scenarios for a client-facing, non-technical consultant who is comfortable using AI tools but has never been taught how to tell which AI-approach category fits a given problem. Each scenario is a moment from one of her actual client meetings — a client just described a problem to her, in their own words, and she now has to figure out which kind of AI approach it needs. Write one scenario per AI-approach category in this fixed list: ${CATEGORY_TAXONOMY.join(", ")}.

Write exactly one scenario per category, in the order given above.

Rules:
1. Each scenario is one or two sentences, phrased the way a client would actually describe their problem out loud in a meeting — concrete, specific to their situation, never a textbook definition of the category, and never naming a specific commercial product, vendor, or model.
2. Vary the industry across scenarios (e.g. retail, legal, healthcare, logistics, marketing, financial services, manufacturing, energy) — do not repeat an industry.
3. Assign a "difficulty": "easy" when there's one dominant reading and little to argue with, "medium" when a plausible wrong answer sits next to the right one, "hard" when the obvious first instinct is usually the wrong one.
4. "intendedCategory" must be copied verbatim from the fixed list above — the exact category this scenario was written for.

Respond with ONLY a JSON object in this shape — no prose, no markdown fences:
{"candidates": [{"rawInput": string, "industry": string, "intendedCategory": string, "difficulty": "easy" | "medium" | "hard"}]}`;

type RawCandidate = {
  rawInput: string;
  industry: string;
  intendedCategory: string;
  difficulty: string;
};

type RawResponse = { candidates: RawCandidate[] };

function isRawResponse(parsed: unknown): parsed is RawResponse {
  if (typeof parsed !== "object" || parsed === null) return false;
  const candidate = parsed as Partial<RawResponse>;
  return (
    Array.isArray(candidate.candidates) &&
    candidate.candidates.every(
      (c) =>
        typeof c === "object" &&
        c !== null &&
        typeof (c as RawCandidate).rawInput === "string" &&
        typeof (c as RawCandidate).industry === "string" &&
        typeof (c as RawCandidate).intendedCategory === "string" &&
        typeof (c as RawCandidate).difficulty === "string"
    )
  );
}

export async function generatePracticeCaseCandidates(): Promise<PracticeCaseCandidate[]> {
  const client = getGroqClient();

  const response = await withRetry((signal) =>
    client.chat.completions.create(
      {
        model: "openai/gpt-oss-120b",
        reasoning_effort: "low",
        max_tokens: 2000,
        response_format: { type: "json_object" },
        messages: [{ role: "system", content: SYSTEM_PROMPT }],
      },
      { maxRetries: 0, signal }
    )
  );

  checkFinishReason(response.choices[0]?.finish_reason, "generate-cases");

  const text = response.choices[0]?.message?.content ?? "";
  const parsed = parseJsonResponse(text, isRawResponse, "generate-cases");

  // Off-taxonomy category or bad difficulty is dropped, not fatal — mirrors
  // reveal.ts's handling of off-taxonomy alternatives: one bad item in a
  // batch shouldn't discard the rest.
  const candidates: PracticeCaseCandidate[] = parsed.candidates
    .filter((c) => isCategory(c.intendedCategory) && isDifficulty(c.difficulty))
    .map((c) => ({
      rawInput: c.rawInput,
      industry: c.industry,
      intendedCategory: c.intendedCategory as Category,
      difficulty: c.difficulty as Difficulty,
    }));

  if (candidates.length === 0) {
    throw new Error("Model returned no usable practice-case candidates");
  }

  return candidates;
}
