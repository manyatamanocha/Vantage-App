import { describe, it, expect, vi } from "vitest";

const mockResponse = {
  match: false,
  revealedCategory: "RAG",
  whyItFits:
    "The client needs answers grounded in their own documents, not generated from general knowledge.",
  whyNotAlternatives: [
    {
      category: "Classification",
      reason: "There's no fixed label set to sort inputs into.",
    },
  ],
  toolClass: "specialized",
};

const VALID_RESPONSE = {
  choices: [{ message: { content: JSON.stringify(mockResponse) } }],
};

// vi.fn() (not a bare arrow) so individual tests can override it with
// mockReturnValueOnce — vi.mocked() is a type-level cast only at runtime.
vi.mock("@/lib/groq", () => ({
  getGroqClient: vi.fn(() => ({
    chat: { completions: { create: async () => VALID_RESPONSE } },
  })),
}));

import { recommendCategory } from "../reveal";
import { CATEGORY_TAXONOMY } from "../taxonomy";

const INPUT = {
  goal: "Answer client questions from internal docs",
  problemType: "Doc Q&A",
  guessedCategory: "Classification",
};

/** Point the mocked client at a single canned completion body. */
async function mockCompletionOnce(content: string) {
  const { getGroqClient } = await import("@/lib/groq");
  const create = vi
    .fn()
    .mockResolvedValue({ choices: [{ message: { content } }] });
  vi.mocked(getGroqClient).mockReturnValueOnce({
    chat: { completions: { create } },
  } as never);
  return create;
}

describe("recommendCategory", () => {
  it("returns match=false when the guess differs from the revealed category", async () => {
    const result = await recommendCategory(INPUT);
    expect(result.match).toBe(false);
    expect(result.revealedCategory).toBe("RAG");
    expect(result.whyNotAlternatives.length).toBeGreaterThan(0);
    expect(result.whyItFits).toBe(mockResponse.whyItFits);
    expect(result.toolClass).toBe("specialized");
  });

  it("returns match=true when the guess is the revealed category", async () => {
    const result = await recommendCategory({ ...INPUT, guessedCategory: "RAG" });
    expect(result.match).toBe(true);
  });

  it("derives match from the guess itself, not from the model's own claim", async () => {
    // The model contradicts itself: says the guess matched while revealing a
    // different category. `match` drives the persisted `correct` flag and the
    // whole progress record, so it is computed here, never taken on trust.
    await mockCompletionOnce(JSON.stringify({ ...mockResponse, match: true }));
    const result = await recommendCategory(INPUT);
    expect(result.match).toBe(false);
  });

  it("throws when the revealed category is outside the taxonomy", async () => {
    await mockCompletionOnce(
      JSON.stringify({ ...mockResponse, revealedCategory: "Vector Search" })
    );
    await expect(recommendCategory(INPUT)).rejects.toThrow(/taxonomy/i);
  });

  it("throws a clear error on an unparseable response", async () => {
    await mockCompletionOnce("Sure! Here's the answer:");
    await expect(recommendCategory(INPUT)).rejects.toThrow(/parse/i);
  });

  it("throws a clear error when the JSON is missing or mistypes required fields", async () => {
    await mockCompletionOnce(
      JSON.stringify({ revealedCategory: "RAG", whyItFits: 42 })
    );
    await expect(recommendCategory(INPUT)).rejects.toThrow(/parse/i);
  });

  it("throws when toolClass is not one of the two allowed classes", async () => {
    await mockCompletionOnce(
      JSON.stringify({ ...mockResponse, toolClass: "Pinecone" })
    );
    await expect(recommendCategory(INPUT)).rejects.toThrow(/parse/i);
  });

  it("drops alternatives that are off-taxonomy or restate the revealed category", async () => {
    // Anything that isn't a taxonomy category is a named product or invention —
    // the plan forbids surfacing either.
    await mockCompletionOnce(
      JSON.stringify({
        ...mockResponse,
        whyNotAlternatives: [
          { category: "Classification", reason: "No fixed label set here." },
          { category: "A vector database", reason: "That's a product, not a category." },
          { category: "RAG", reason: "Restates the revealed category." },
          { category: "Summarization", reason: "They need the answer, not a shorter doc." },
        ],
      })
    );
    const result = await recommendCategory(INPUT);
    expect(result.whyNotAlternatives.map((a) => a.category)).toEqual([
      "Classification",
      "Summarization",
    ]);
  });

  it("throws when no usable alternative survives — comparative reasoning is the point of this step", async () => {
    await mockCompletionOnce(
      JSON.stringify({ ...mockResponse, whyNotAlternatives: [] })
    );
    await expect(recommendCategory(INPUT)).rejects.toThrow(/alternative/i);
  });

  it("asks for JSON mode, disables the SDK's own retries, and passes an abort signal", async () => {
    const create = await mockCompletionOnce(JSON.stringify(mockResponse));

    await recommendCategory(INPUT);

    const [body, options] = create.mock.calls[0];
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.model).toBe("llama-3.3-70b-versatile");
    // Groq's JSON mode requires the word "JSON" somewhere in the messages.
    expect(
      body.messages.some((m: { content: string }) => /json/i.test(m.content))
    ).toBe(true);
    expect(options.maxRetries).toBe(0);
    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(options.signal.aborted).toBe(false);
  });

  it("constrains the model to the taxonomy, bans named products, and demands problem-specific comparisons", async () => {
    const create = await mockCompletionOnce(JSON.stringify(mockResponse));

    await recommendCategory(INPUT);

    const [body] = create.mock.calls[0];
    const system = body.messages.find(
      (m: { role: string }) => m.role === "system"
    ).content;
    for (const category of CATEGORY_TAXONOMY) {
      expect(system).toContain(category);
    }
    expect(system).toMatch(/never name a product/i);
    // The comparative half of the reveal must be about THIS problem, not a
    // dictionary definition of each category.
    expect(system).toMatch(/whyNotAlternatives/);
    expect(system).toMatch(/definition/i);
    expect(system).toMatch(/general-purpose/);
    expect(system).toMatch(/specialized/);

    const user = body.messages.find(
      (m: { role: string }) => m.role === "user"
    ).content;
    expect(user).toContain(INPUT.goal);
    expect(user).toContain(INPUT.problemType);
    expect(user).toContain(INPUT.guessedCategory);
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

    const result = await recommendCategory(INPUT);
    expect(create).toHaveBeenCalledTimes(2);
    expect(result.revealedCategory).toBe("RAG");
  });

  it("gives up after a single retry without inventing a recommendation", async () => {
    const { getGroqClient } = await import("@/lib/groq");
    const create = vi.fn().mockRejectedValue(new Error("groq is down"));
    vi.mocked(getGroqClient).mockReturnValueOnce({
      chat: { completions: { create } },
    } as never);

    await expect(recommendCategory(INPUT)).rejects.toThrow(/groq is down/);
    expect(create).toHaveBeenCalledTimes(2);
  });
});
