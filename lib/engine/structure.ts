import { getGroqClient } from "@/lib/groq";

const SYSTEM_PROMPT = `You turn a messy, informal client ask into two fields: a clear one-sentence "goal" and a one-sentence "problemType" description. Respond with ONLY a JSON object: {"goal": "...", "problemType": "..."}. No prose, no markdown fences.`;

export async function structureProblem(
  rawInput: string,
  industry?: string
): Promise<{ goal: string; problemType: string }> {
  const client = getGroqClient();
  const userContent = industry
    ? `Industry: ${industry}\nClient ask: ${rawInput}`
    : `Client ask: ${rawInput}`;

  const response = await withRetry(() =>
    client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 300,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
    })
  );

  const text = response.choices[0]?.message?.content ?? "";
  try {
    const parsed = JSON.parse(text);
    if (
      typeof parsed.goal !== "string" ||
      typeof parsed.problemType !== "string"
    ) {
      throw new Error("missing fields");
    }
    return { goal: parsed.goal, problemType: parsed.problemType };
  } catch {
    throw new Error("Failed to parse structure response");
  }
}

async function withRetry<T>(fn: () => Promise<T>, timeoutMs = 15000): Promise<T> {
  const attempt = () => {
    let timer: ReturnType<typeof setTimeout>;
    return Promise.race([
      fn(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("timeout")), timeoutMs);
      }),
    ]).finally(() => clearTimeout(timer));
  };
  try {
    return await attempt();
  } catch {
    // Exactly one retry. If the second attempt fails its error propagates —
    // no fallback content is ever invented.
    return await attempt();
  }
}
