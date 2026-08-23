import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/groq", () => ({
  getGroqClient: vi.fn(() => ({
    chat: {
      completions: {
        create: async () => ({
          choices: [
            {
              message: {
                content:
                  "Draft: here's how we'll address churn using a prediction model...",
              },
            },
          ],
        }),
      },
    },
  })),
}));

import { generateHandback } from "../handback";

describe("generateHandback", () => {
  it("returns non-empty draft text", async () => {
    const text = await generateHandback({
      goal: "Reduce churn",
      problemType: "Predict cancellations",
      revealedCategory: "Prediction",
    });
    expect(text.length).toBeGreaterThan(0);
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
