import { getGroqClient } from "@/lib/groq";
import { withRetry } from "./with-retry";
import { parseJsonResponse } from "./parse-json-response";

// Groq's JSON mode requires the word "JSON" to appear in the messages — it is in
// this system prompt, which is sent on every call.
const SYSTEM_PROMPT = `You turn a messy, informal client ask into two fields: a clear one-sentence "goal" and a one-sentence "problemType" description. Respond with ONLY a JSON object: {"goal": "...", "problemType": "..."}. No prose, no markdown fences.`;

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
        max_tokens: 300,
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

  const text = response.choices[0]?.message?.content ?? "";
  const { goal, problemType } = parseJsonResponse(
    text,
    isProblemStructure,
    "structure"
  );
  return { goal, problemType };
}
