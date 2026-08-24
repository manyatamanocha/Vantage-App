import { getGroqClient } from "@/lib/groq";
import { withRetry } from "./with-retry";
import { parseJsonResponse } from "./parse-json-response";
import { checkFinishReason } from "./check-finish-reason";

// Unlike recommendCategory (which teaches the AI-approach category and
// deliberately never names a product), this answers the consultant's actual
// question directly — it needs to be able to say "open Excel" or "use a
// pivot table," so assertNoNamedProducts is deliberately NOT applied here.
const SYSTEM_PROMPT = `You directly answer a person's practical question or problem in plain, concrete language — real steps or a real explanation, not category theory. Keep it short: 3-6 sentences, or a short numbered list for step-by-step tasks. Respond with ONLY a JSON object: {"solution": "..."}. No prose, no markdown fences.`;

type RawSolution = { solution: string };

function isRawSolution(parsed: unknown): parsed is RawSolution {
  return (
    typeof parsed === "object" &&
    parsed !== null &&
    typeof (parsed as RawSolution).solution === "string"
  );
}

export async function generateSolution(rawInput: string): Promise<string> {
  const client = getGroqClient();

  const response = await withRetry((signal) =>
    client.chat.completions.create(
      {
        model: "openai/gpt-oss-120b",
        reasoning_effort: "low",
        max_tokens: 1500,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: rawInput },
        ],
      },
      { maxRetries: 0, signal }
    )
  );

  checkFinishReason(response.choices[0]?.finish_reason, "solution");

  const text = response.choices[0]?.message?.content ?? "";
  const { solution } = parseJsonResponse(text, isRawSolution, "solution");
  return solution;
}
