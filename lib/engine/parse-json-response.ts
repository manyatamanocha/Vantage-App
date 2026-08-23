/**
 * The generic "parse a model's JSON response, or fail loudly" shell shared by
 * every Groq call site. Field-specific validation stays at the call site and
 * plugs in via the `validate` type guard.
 *
 * Never invents fallback content: any failure throws an error whose message
 * mentions parsing and carries the original response text (truncated) so the
 * failure is diagnosable from logs.
 */
export function parseJsonResponse<T>(
  text: string,
  validate: (parsed: unknown) => parsed is T,
  label = "model"
): T {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (cause) {
    throw new Error(
      `Failed to parse ${label} response as JSON. Response was: ${preview(text)}`,
      { cause }
    );
  }

  if (!validate(parsed)) {
    throw new Error(
      `Failed to parse ${label} response: unexpected shape. Response was: ${preview(text)}`
    );
  }

  return parsed;
}

function preview(text: string, maxLength = 300): string {
  const trimmed = text.trim();
  if (!trimmed) return "<empty>";
  return trimmed.length > maxLength
    ? `${trimmed.slice(0, maxLength)}…`
    : trimmed;
}
