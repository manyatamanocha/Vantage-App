import { getGroqClient } from "@/lib/groq";
import { withRetry } from "./with-retry";
import { parseJsonResponse } from "./parse-json-response";
import { checkFinishReason } from "./check-finish-reason";

// Groq's JSON mode requires the word "JSON" to appear in the messages — it is in
// this system prompt, which is sent on every call.
const SYSTEM_PROMPT = `You turn a messy, informal client ask — often containing spelling mistakes, typos, or grammar errors, since it may be typed quickly or dictated — into two fields: a clear one-sentence "goal" and a one-sentence "problemType" description. Correct all spelling, grammar, and typos; write the goal as a properly-worded sentence a professional would write, not a copy of the original phrasing. Preserve the actual meaning and intent — do not change what they're asking for. Respond with ONLY a JSON object: {"goal": "...", "problemType": "..."}. No prose, no markdown fences.`;

export type ProblemStructure = { goal: string; problemType: string };

function isProblemStructure(parsed: unknown): parsed is ProblemStructure {
  if (typeof parsed !== "object" || parsed === null) return false;
  const candidate = parsed as Partial<ProblemStructure>;
  return (
    typeof candidate.goal === "string" &&
    typeof candidate.problemType === "string"
  );
}

export async function structureProblem(
  rawInput: string,
  industry?: string
): Promise<ProblemStructure> {
  const client = getGroqClient();
  const userContent = industry
    ? `Industry: ${industry}\nClient ask: ${rawInput}`
    : `Client ask: ${rawInput}`;

  const response = await withRetry((signal) =>
    client.chat.completions.create(
      {
        model: "openai/gpt-oss-120b",
        // openai/gpt-oss-120b is a reasoning model: its reasoning tokens draw
        // from this same completion-token budget. "low" keeps reasoning
        // short for a two-field extraction task, and max_tokens is sized
        // generously above that so a legitimately longer answer still fits
        // — these are cheap free-tier calls, not a cost concern for an MVP.
        reasoning_effort: "low",
        max_tokens: 1000,
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

  checkFinishReason(response.choices[0]?.finish_reason, "structure");

  const text = response.choices[0]?.message?.content ?? "";
  const { goal, problemType } = parseJsonResponse(
    text,
    isProblemStructure,
    "structure"
  );
  return { goal, problemType };
}
