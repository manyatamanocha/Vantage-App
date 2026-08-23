import { describe, it, expect, vi } from "vitest";

const VALID_RESPONSE = {
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
};

vi.mock("@/lib/groq", () => ({
  // vi.fn() (not a bare arrow) so individual tests can override it with
  // mockReturnValueOnce — vi.mocked() is a type-level cast only at runtime.
  getGroqClient: vi.fn(() => ({
    chat: {
      completions: {
        create: async () => VALID_RESPONSE,
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

  it("throws a clear error when the JSON is missing the required fields", async () => {
    const { getGroqClient } = await import("@/lib/groq");
    vi.mocked(getGroqClient).mockReturnValueOnce({
      chat: {
        completions: {
          create: async () => ({
            choices: [{ message: { content: JSON.stringify({ goal: 1 }) } }],
          }),
        },
      },
    } as never);
    await expect(structureProblem("x")).rejects.toThrow(/parse/i);
  });

  it("asks for JSON mode, disables the SDK's own retries, and passes an abort signal", async () => {
    const { getGroqClient } = await import("@/lib/groq");
    const create = vi.fn().mockResolvedValue(VALID_RESPONSE);
    vi.mocked(getGroqClient).mockReturnValueOnce({
      chat: { completions: { create } },
    } as never);

    await structureProblem("x", "SaaS");

    const [body, options] = create.mock.calls[0];
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.model).toBe("openai/gpt-oss-120b");
    // openai/gpt-oss-120b is a reasoning model; keep reasoning tokens bounded
    // so they don't eat the whole completion-token budget.
    expect(body.reasoning_effort).toBe("low");
    // Groq's JSON mode requires the word "JSON" somewhere in the messages.
    expect(
      body.messages.some((m: { content: string }) => /json/i.test(m.content))
    ).toBe(true);
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
              {
                finish_reason: "length",
                message: { content: '{"goal": "incomplete' },
              },
            ],
          }),
        },
      },
    } as never);

    await expect(structureProblem("x")).rejects.toThrow(/truncated/i);
  });

  it("retries the model call exactly once when the first attempt fails", async () => {
    const { getGroqClient } = await import("@/lib/groq");
    const create = vi
      .fn()
      .mockRejectedValueOnce(new Error("transient network failure"))
      .mockResolvedValueOnce(VALID_RESPONSE);
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
