/**
 * Shared truncation check for every Groq call site.
 *
 * `openai/gpt-oss-120b` is a reasoning model: its reasoning tokens count
 * against the same completion-token budget as the visible output, so a
 * response can run out of budget mid-thought. When that happens Groq reports
 * `finish_reason: "length"` and `content` is whatever was generated before
 * the cutoff — usually not valid JSON, and sometimes empty. Left unchecked,
 * that surfaces downstream as a generic "failed to parse" or "empty text"
 * error that gives no hint about the actual cause. Checking `finish_reason`
 * first turns that into a specific, actionable error instead.
 */
export function checkFinishReason(
  finishReason: string | null | undefined,
  label: string
): void {
  if (finishReason === "length") {
    throw new Error(
      `${label} response was truncated (finish_reason: "length") — the model ran out of ` +
        `completion tokens before finishing, likely consumed by reasoning tokens. Consider ` +
        `raising max_tokens or lowering reasoning_effort.`
    );
  }
}
