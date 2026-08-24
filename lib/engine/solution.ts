import { getGroqClient } from "@/lib/groq";
import { withRetry } from "./with-retry";
import { parseJsonResponse } from "./parse-json-response";
import { checkFinishReason } from "./check-finish-reason";

// Unlike recommendCategory (which teaches the AI-approach category and
// deliberately never names a product), this answers the consultant's actual
// question directly — it needs to be able to name real tools like Excel or
// Power Automate, so assertNoNamedProducts is deliberately NOT applied here.
const SYSTEM_PROMPT = `You directly answer a person's practical question or problem with a real, actionable solution, assuming they may not know even the basics — like a patient friend walking them through it in person. Be concise and to the point — no filler, no generic advice, no restating the question. Write in plain, simple language — short sentences, everyday words, no jargon (explain any term you can't avoid using).

Each step must be a single, literal, physical action — click something specific, type something specific, or look for something specific on the screen — never a summary of several actions bundled together, and never assume the person already knows where something is or how to get to it. If a step involves finding or opening something, say exactly how (e.g. "click the search icon or press the Windows key, type the name, then click the app when it appears in the results") rather than assuming they already know how to open it.

Respond with ONLY a JSON object in this exact shape, no prose, no markdown fences:
{
  "overview": "one concise sentence on the approach",
  "tools": [{"name": "...", "description": "one short phrase on what it's for"}],
  "steps": [{"title": "...", "description": "one short, concrete sentence — a single literal action, not a summary", "detail": "optional short code snippet, formula, or concrete example — empty string if not applicable"}],
  "proTips": ["short actionable tip", "..."]
}
Give 2-4 tools, 4-8 steps, and 2-3 pro tips. Every step must be a specific, concrete action for THIS exact question — never a generic step that would apply to any similar task.`;

export type SolutionResult = {
  overview: string;
  tools: { name: string; description: string }[];
  steps: { title: string; description: string; detail: string }[];
  proTips: string[];
};

type RawSolution = { overview?: unknown; tools?: unknown; steps?: unknown; proTips?: unknown };

function isRawShape(parsed: unknown): parsed is RawSolution {
  return typeof parsed === "object" && parsed !== null;
}

function isTool(value: unknown): value is { name: string; description: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { name?: unknown }).name === "string" &&
    typeof (value as { description?: unknown }).description === "string"
  );
}

function isStep(value: unknown): value is { title: string; description: string; detail?: string } {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { title?: unknown }).title === "string" &&
    typeof (value as { description?: unknown }).description === "string"
  );
}

export async function generateSolution(rawInput: string): Promise<SolutionResult> {
  const client = getGroqClient();

  const response = await withRetry((signal) =>
    client.chat.completions.create(
      {
        model: "openai/gpt-oss-120b",
        reasoning_effort: "low",
        max_tokens: 3000,
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
  const parsed = parseJsonResponse(text, isRawShape, "solution");

  if (typeof parsed.overview !== "string") {
    throw new Error(`Failed to parse solution response: missing overview. Response was: ${text.slice(0, 300)}`);
  }

  // The model occasionally interleaves stray empty strings between real
  // array entries (e.g. [obj, "", obj, "", obj]) — a cosmetic JSON-generation
  // quirk, not a sign the real content is bad. Filtering to well-shaped
  // entries rather than rejecting the whole response on any one malformed
  // entry is what actually fixes solutions failing to generate at all.
  const tools = Array.isArray(parsed.tools) ? parsed.tools.filter(isTool) : [];
  const steps = Array.isArray(parsed.steps)
    ? parsed.steps.filter(isStep).map((step) => ({ ...step, detail: step.detail ?? "" }))
    : [];
  const proTips = Array.isArray(parsed.proTips)
    ? parsed.proTips.filter((tip): tip is string => typeof tip === "string" && tip.trim().length > 0)
    : [];

  if (steps.length === 0) {
    throw new Error(`Failed to parse solution response: no usable steps. Response was: ${text.slice(0, 300)}`);
  }

  return { overview: parsed.overview, tools, steps, proTips };
}
