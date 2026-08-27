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

import { structureProblem, AskRefusedError } from "../structure";

/** Builds the shape groq-sdk throws when the model's refusal breaks JSON mode. */
function jsonModeFailure(failedGeneration: string) {
  const body = {
    error: {
      message:
        "Failed to generate JSON. Please adjust your prompt. See 'failed_generation' for more details.",
      type: "invalid_request_error",
      code: "json_validate_failed",
      failed_generation: failedGeneration,
    },
  };
  return Object.assign(new Error(`400 ${JSON.stringify(body)}`), {
    status: 400,
    error: body.error,
  });
}

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

  // A harmful or abusive ask must come back as a refusal the intake screen can
  // show calmly — never as a parse crash. The model declines in three
  // different shapes in practice (verified against the live endpoint), so all
  // three have to land on AskRefusedError.
  describe("when the model declines the ask", () => {
    async function respondWith(content: string) {
      const { getGroqClient } = await import("@/lib/groq");
      vi.mocked(getGroqClient).mockReturnValueOnce({
        chat: {
          completions: { create: async () => ({ choices: [{ message: { content } }] }) },
        },
      } as never);
    }

    it("raises AskRefusedError when the model uses the refusal field we asked for", async () => {
      await respondWith(JSON.stringify({ refusal: "This ask seeks to harm someone." }));
      await expect(structureProblem("x")).rejects.toBeInstanceOf(AskRefusedError);
    });

    it("raises AskRefusedError when the model declines in its own {error} shape", async () => {
      await respondWith(JSON.stringify({ error: "I'm sorry, but I can't help with that." }));
      await expect(structureProblem("x")).rejects.toBeInstanceOf(AskRefusedError);
    });

    it("raises AskRefusedError when the refusal breaks JSON mode entirely", async () => {
      const { getGroqClient } = await import("@/lib/groq");
      vi.mocked(getGroqClient).mockReturnValue({
        chat: {
          completions: {
            // Curly apostrophe — that is what the model actually returns.
            create: vi.fn().mockRejectedValue(jsonModeFailure("I’m sorry, but I can’t help with that.")),
          },
        },
      } as never);
      await expect(structureProblem("x")).rejects.toBeInstanceOf(AskRefusedError);
      vi.mocked(getGroqClient).mockReset();
    });

    it("carries a message safe to show the user, not the model's own wording", async () => {
      await respondWith(JSON.stringify({ error: "Refused" }));
      await expect(structureProblem("x")).rejects.toThrow(/can't help with that/i);
    });
  });

  // The opposite risk: telling someone with a perfectly good question that we
  // won't answer it. A JSON-mode failure with no refusal language in it is an
  // ordinary model failure and must stay an ordinary error.
  it("does not treat a non-refusal JSON-mode failure as a refusal", async () => {
    const { getGroqClient } = await import("@/lib/groq");
    vi.mocked(getGroqClient).mockReturnValue({
      chat: {
        completions: {
          create: vi.fn().mockRejectedValue(jsonModeFailure("{\"goal\": \"Reduce chu")),
        },
      },
    } as never);
    await expect(structureProblem("x")).rejects.not.toBeInstanceOf(AskRefusedError);
    vi.mocked(getGroqClient).mockReset();
  });
});
