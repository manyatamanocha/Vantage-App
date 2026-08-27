import { getGroqClient } from "@/lib/groq";
import { withRetry } from "./with-retry";
import { parseJsonResponse } from "./parse-json-response";
import { checkFinishReason } from "./check-finish-reason";

// Groq's JSON mode requires the word "JSON" to appear in the messages — it is in
// this system prompt, which is sent on every call.
const SYSTEM_PROMPT = `You turn a messy, informal client ask — often containing spelling mistakes, typos, or grammar errors, since it may be typed quickly or dictated — into two fields: a clear one-sentence "goal" and a one-sentence "problemType" description.

Correct all spelling, grammar, and typos, including garbled product/tool/brand names — if a misspelled word is clearly a typo for a real, well-known product or tool (e.g. "tablues" -> "Tableau", "powerbi"/"porbi" -> "Power BI", "exel" -> "Excel"), silently correct it to that real name in the goal. Only ever correct a misspelling to the word the writer plainly meant — never "correct" a word into a different word that changes what is being asked (e.g. "bom" in "how do i build a bom" is not "bill of materials"). If a word is ambiguous, keep the writer's meaning rather than substituting a more convenient one. Do not hedge, and never invent a "clarify with the client" framing for something you can confidently identify — that only makes sense for genuinely ambiguous input, not an obvious typo. Write the goal as a properly-worded sentence a professional would write, not a copy of the original phrasing. Preserve the actual meaning and intent — do not change what they're asking for.

If the ask is harmful, abusive, illegal, or is asking for help to hurt, deceive, harass, or spy on someone, do NOT extract a goal from it and do NOT restate it. Respond with ONLY this JSON object instead: {"refusal": "<one short sentence saying why>"}.

Otherwise respond with ONLY a JSON object: {"goal": "...", "problemType": "..."}. No prose, no markdown fences.`;

/**
 * What the intake screen shows when an ask is declined. Deliberately one
 * fixed, app-owned sentence rather than the model's own wording: the model
 * declines with anything from "Refused" to a full apology paragraph, and none
 * of it is written for this product's voice or safe to render unreviewed.
 */
export const REFUSED_ASK_MESSAGE =
  "I can't help with that one. Try asking about a work or business problem instead.";

/**
 * Raised when the model declines the ask rather than structuring it. This is
 * a normal, expected outcome — not a bug — so callers should catch it and
 * show REFUSED_ASK_MESSAGE calmly instead of surfacing a crash or a retry
 * button that could never succeed. `detail` keeps the model's own words for
 * the logs only.
 */
export class AskRefusedError extends Error {
  readonly detail: string;
  constructor(detail: string) {
    super(REFUSED_ASK_MESSAGE);
    this.name = "AskRefusedError";
    this.detail = detail;
  }
}

/**
 * Refusal language, used only to tell a declined ask apart from an ordinary
 * model failure. Kept deliberately tight: matching too eagerly would tell
 * someone with a perfectly good question that we refuse to answer it, which
 * is a worse failure than the crash this replaces.
 */
const REFUSAL_LANGUAGE =
  /\b(?:i(?:'|’)?m sorry|i am sorry|i can(?:'|’)?t help|i cannot help|can(?:'|’)?t help with that|cannot help with that|i (?:can(?:'|’)?t|cannot|won(?:'|’)?t) (?:assist|comply|provide)|unable to (?:help|assist)|refus(?:e|ed|al))\b/i;

export type ProblemStructure = { goal: string; problemType: string };

/**
 * Beyond the shape we asked for, the model declines in two observed shapes:
 * the `refusal` field the prompt requests, and its own untaught `{"error":
 * "..."}` — both verified against the live endpoint. Accepting both here is
 * what keeps a refusal from arriving as "unexpected shape" parse failure.
 */
type RawStructureResponse =
  | ProblemStructure
  | { refusal: string }
  | { error: string };

function isProblemStructure(parsed: unknown): parsed is ProblemStructure {
  if (typeof parsed !== "object" || parsed === null) return false;
  const candidate = parsed as Partial<ProblemStructure>;
  return (
    typeof candidate.goal === "string" &&
    typeof candidate.problemType === "string"
  );
}

function refusalText(parsed: unknown): string | null {
  if (typeof parsed !== "object" || parsed === null) return null;
  const candidate = parsed as { refusal?: unknown; error?: unknown };
  if (typeof candidate.refusal === "string") return candidate.refusal;
  if (typeof candidate.error === "string") return candidate.error;
  return null;
}

function isStructureResponse(parsed: unknown): parsed is RawStructureResponse {
  return isProblemStructure(parsed) || refusalText(parsed) !== null;
}

/**
 * A refusal sometimes never becomes JSON at all: the model answers "I'm sorry,
 * but I can't help with that", Groq's JSON mode rejects it, and the SDK throws
 * a 400 `json_validate_failed` carrying that prose in `failed_generation`.
 * Returns the refusal text, or null when the failure was an ordinary one (a
 * truncated object, say) that must stay an ordinary error.
 */
function jsonModeRefusal(err: unknown): string | null {
  const body =
    typeof err === "object" && err !== null && "error" in err
      ? JSON.stringify((err as { error: unknown }).error)
      : "";
  const haystack = `${err instanceof Error ? err.message : String(err)} ${body}`;
  if (!haystack.includes("json_validate_failed")) return null;
  return REFUSAL_LANGUAGE.test(haystack) ? haystack.slice(0, 300) : null;
}

export async function structureProblem(
  rawInput: string,
  industry?: string
): Promise<ProblemStructure> {
  const client = getGroqClient();
  const userContent = industry
    ? `Industry: ${industry}\nClient ask: ${rawInput}`
    : `Client ask: ${rawInput}`;

  const response = await callModel(client, userContent);

  checkFinishReason(response.choices[0]?.finish_reason, "structure");

  const text = response.choices[0]?.message?.content ?? "";
  const parsed = parseJsonResponse(text, isStructureResponse, "structure");

  const refusal = refusalText(parsed);
  if (refusal) throw new AskRefusedError(refusal);

  const { goal, problemType } = parsed as ProblemStructure;
  return { goal, problemType };
}

async function callModel(
  client: ReturnType<typeof getGroqClient>,
  userContent: string
) {
  try {
    return await withRetry((signal) =>
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
  } catch (err) {
    const refusal = jsonModeRefusal(err);
    if (refusal) throw new AskRefusedError(refusal);
    throw err;
  }
}
