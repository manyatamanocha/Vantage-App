import { describe, it, expect, vi } from "vitest";

const VALID_RESPONSE = {
  choices: [
    {
      message: {
        content:
          "Draft: here's how we'll address churn using a prediction model...",
      },
    },
  ],
};

// vi.fn() (not a bare arrow) so individual tests can override it with
// mockReturnValueOnce — vi.mocked() is a type-level cast only at runtime.
vi.mock("@/lib/groq", () => ({
  getGroqClient: vi.fn(() => ({
    chat: {
      completions: {
        create: async () => VALID_RESPONSE,
      },
    },
  })),
}));

import { generateHandback } from "../handback";

const INPUT = {
  goal: "Reduce churn",
  problemType: "Predict cancellations",
  revealedCategory: "Prediction",
};

describe("generateHandback", () => {
  it("returns non-empty draft text", async () => {
    const text = await generateHandback(INPUT);
    expect(text.length).toBeGreaterThan(0);
  });

  it("sends the new model and disables the SDK's own retries", async () => {
    const { getGroqClient } = await import("@/lib/groq");
    const create = vi.fn().mockResolvedValue(VALID_RESPONSE);
    vi.mocked(getGroqClient).mockReturnValueOnce({
      chat: { completions: { create } },
    } as never);

    await generateHandback(INPUT);

    const [body, options] = create.mock.calls[0];
    expect(body.model).toBe("openai/gpt-oss-120b");
    // openai/gpt-oss-120b is a reasoning model; keep reasoning tokens
    // bounded so they don't eat the whole completion-token budget.
    expect(body.reasoning_effort).toBe("low");
    expect(options.maxRetries).toBe(0);
    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(options.signal.aborted).toBe(false);
  });

  it("throws a clear truncation error when finish_reason is 'length'", async () => {
    const { getGroqClient } = await import("@/lib/groq");
    vi.mocked(getGroqClient).mockReturnValueOnce({
      chat: {
        completions: {
          create: async () => ({
            choices: [
              { finish_reason: "length", message: { content: "Draft: her" } },
            ],
          }),
        },
      },
    } as never);

    await expect(generateHandback(INPUT)).rejects.toThrow(/truncated/i);
  });

  it("throws when the model returns empty text", async () => {
    const { getGroqClient } = await import("@/lib/groq");
    vi.mocked(getGroqClient).mockReturnValueOnce({
      chat: {
        completions: {
          create: async () => ({ choices: [{ message: { content: "   " } }] }),
        },
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    await expect(
      generateHandback({
        goal: "Reduce churn",
        problemType: "Predict cancellations",
        revealedCategory: "Prediction",
      })
    ).rejects.toThrow(/empty/i);
  });
});
