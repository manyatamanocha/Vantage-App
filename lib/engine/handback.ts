import { getGroqClient } from "@/lib/groq";
import { withRetry } from "./with-retry";

/**
 * The third Groq call site: a short, client-facing draft the consultant can
 * hand to their client. Unlike Structure and Reveal, this output is plain
 * prose, not JSON — there is no `parseJsonResponse` step here, and no
 * `response_format` on the request.
 */
const SYSTEM_PROMPT = `You write a short, client-facing takeaway draft (3-5 sentences) summarizing how AI will address the client's problem, given the confirmed problem and AI-approach category. Plain language, no jargon. Speak only in terms of the AI-approach category and general tool class (e.g. "a general-purpose AI assistant" or "a purpose-built retrieval system") — never name a specific commercial product, vendor, or model. Respond with only the draft text, no preamble.`;

export async function generateHandback(input: {
  goal: string;
  problemType: string;
  revealedCategory: string;
}): Promise<string> {
  const client = getGroqClient();
  const userContent = `Goal: ${input.goal}\nProblem type: ${input.problemType}\nCategory: ${input.revealedCategory}`;

  const response = await withRetry((signal) =>
    client.chat.completions.create(
      {
        model: "openai/gpt-oss-120b",
        max_tokens: 400,
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
  if (!text.trim()) throw new Error("Handback generation returned empty text");
  return text;
}
