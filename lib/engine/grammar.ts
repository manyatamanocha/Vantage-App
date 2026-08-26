import { getGroqClient } from "@/lib/groq";
import { withRetry } from "./with-retry";
import { parseJsonResponse } from "./parse-json-response";
import { checkFinishReason } from "./check-finish-reason";

// Live, as-you-type grammar/wording check for the intake textarea. Unlike
// structureProblem (which extracts goal/problemType), this only fixes
// grammar, spelling, and sentence formation — it must not rephrase the
// meaning, add detail, or resolve ambiguity. Groq's JSON mode requires the
// word "JSON" to appear in the messages — it is in this system prompt.
const SYSTEM_PROMPT = `You correct grammar, spelling, and sentence formation only. Fix typos, subject-verb agreement, double negatives, missing/wrong words ("too work" -> "to work"), and punctuation. Correct obviously misspelled product/tool/brand names to the real name (e.g. "powerbi" -> "PowerBI", "exel" -> "Excel") — keep it as one word/name if that's how the real brand is written, never split it apart. Do not rephrase, do not add or remove meaning, do not resolve ambiguity, do not make the sentence more formal than the original. If the text is already correct, or too short/fragmentary to correct confidently, return it unchanged. Respond with ONLY a JSON object: {"correctedText": "..."}. No prose, no markdown fences.`;

export type GrammarCheckResult = { correctedText: string; changed: boolean };

function isRawResult(parsed: unknown): parsed is { correctedText: string } {
  return (
    typeof parsed === "object" &&
    parsed !== null &&
    typeof (parsed as { correctedText?: unknown }).correctedText === "string"
  );
}

export async function checkGrammar(text: string): Promise<GrammarCheckResult> {
  const client = getGroqClient();

  const response = await withRetry((signal) =>
    client.chat.completions.create(
      {
        model: "openai/gpt-oss-120b",
        reasoning_effort: "low",
        max_tokens: 800,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: text },
        ],
      },
      { maxRetries: 0, signal }
    )
  );

  checkFinishReason(response.choices[0]?.finish_reason, "grammar");

  const responseText = response.choices[0]?.message?.content ?? "";
  const { correctedText } = parseJsonResponse(responseText, isRawResult, "grammar");

  return { correctedText, changed: correctedText.trim() !== text.trim() };
}
