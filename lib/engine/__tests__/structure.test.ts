import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/groq", () => ({
  // vi.fn() (not a bare arrow) so individual tests can override it with
  // mockReturnValueOnce — vi.mocked() is a type-level cast only at runtime.
  getGroqClient: vi.fn(() => ({
    chat: {
      completions: {
        create: async () => ({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  goal: "Reduce churn",
                  problemType: "Predict which customers will cancel",
                }),
              },
            },
          ],
        }),
      },
    },
  })),
}));

import { structureProblem } from "../structure";

describe("structureProblem", () => {
  it("parses goal and problemType from the model response", async () => {
    const result = await structureProblem(
      "client wants to know who will cancel next quarter"
    );
    expect(result.goal).toBe("Reduce churn");
    expect(result.problemType).toBe("Predict which customers will cancel");
  });

  it("throws a clear error on unparseable response", async () => {
    const { getGroqClient } = await import("@/lib/groq");
    vi.mocked(getGroqClient).mockReturnValueOnce({
      chat: {
        completions: {
          create: async () => ({
            choices: [{ message: { content: "not json" } }],
          }),
        },
      },
    } as never);
    await expect(structureProblem("x")).rejects.toThrow(/parse/i);
  });

  it("retries the model call exactly once when the first attempt fails", async () => {
    const { getGroqClient } = await import("@/lib/groq");
    const create = vi
      .fn()
      .mockRejectedValueOnce(new Error("transient network failure"))
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                goal: "Reduce churn",
                problemType: "Predict which customers will cancel",
              }),
            },
          },
        ],
      });
    vi.mocked(getGroqClient).mockReturnValueOnce({
      chat: { completions: { create } },
    } as never);

    const result = await structureProblem("x");
    expect(create).toHaveBeenCalledTimes(2);
    expect(result.goal).toBe("Reduce churn");
  });

  it("gives up after a single retry", async () => {
    const { getGroqClient } = await import("@/lib/groq");
    const create = vi.fn().mockRejectedValue(new Error("groq is down"));
    vi.mocked(getGroqClient).mockReturnValueOnce({
      chat: { completions: { create } },
    } as never);

    await expect(structureProblem("x")).rejects.toThrow(/groq is down/);
    expect(create).toHaveBeenCalledTimes(2);
  });
});
