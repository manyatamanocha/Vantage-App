import { describe, it, expect, vi } from "vitest";

const mockCandidates = [
  { rawInput: "A retailer wants fake reviews flagged before they go live.", industry: "Retail", intendedCategory: "Classification", difficulty: "easy" },
  { rawInput: "A law firm wants a one-page brief of each long deposition.", industry: "Legal", intendedCategory: "Summarization", difficulty: "easy" },
  { rawInput: "A hospital wants nurse questions answered from its handbook.", industry: "Healthcare", intendedCategory: "RAG", difficulty: "medium" },
  { rawInput: "A fitness app wants to know which members will cancel soon.", industry: "Fitness", intendedCategory: "Prediction", difficulty: "medium" },
  { rawInput: "A marketing agency wants first-draft captions for new photos.", industry: "Marketing", intendedCategory: "Generation", difficulty: "easy" },
  { rawInput: "A logistics firm wants invoice line items pulled into its system.", industry: "Logistics", intendedCategory: "Extraction", difficulty: "medium" },
  { rawInput: "A grocery chain wants to suggest what shoppers add next.", industry: "Grocery", intendedCategory: "Recommendation", difficulty: "medium" },
  { rawInput: "A payments processor wants unusual transactions surfaced for review.", industry: "Financial services", intendedCategory: "Anomaly Detection", difficulty: "hard" },
];

const VALID_RESPONSE = {
  choices: [{ message: { content: JSON.stringify({ candidates: mockCandidates }) } }],
};

vi.mock("@/lib/groq", () => ({
  getGroqClient: vi.fn(() => ({
    chat: { completions: { create: async () => VALID_RESPONSE } },
  })),
}));

import { generatePracticeCaseCandidates } from "../generate-cases";
import { CATEGORY_TAXONOMY } from "@/lib/engine/taxonomy";

async function mockCompletionOnce(content: string) {
  const { getGroqClient } = await import("@/lib/groq");
  const create = vi.fn().mockResolvedValue({ choices: [{ message: { content } }] });
  vi.mocked(getGroqClient).mockReturnValueOnce({
    chat: { completions: { create } },
  } as never);
  return create;
}

describe("generatePracticeCaseCandidates", () => {
  it("returns one candidate per taxonomy category", async () => {
    const result = await generatePracticeCaseCandidates();
    expect(result).toHaveLength(8);
    expect(result.map((c) => c.intendedCategory).sort()).toEqual([...CATEGORY_TAXONOMY].sort());
  });

  it("asks for JSON mode and disables the SDK's own retries", async () => {
    const create = await mockCompletionOnce(JSON.stringify({ candidates: mockCandidates }));
    await generatePracticeCaseCandidates();
    const [body, options] = create.mock.calls[0];
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(options.maxRetries).toBe(0);
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });

  it("drops a candidate with a category outside the taxonomy rather than throwing", async () => {
    const withBadCategory = [
      ...mockCandidates.slice(0, 7),
      { rawInput: "Something vague.", industry: "Generic", intendedCategory: "Vector Search", difficulty: "medium" },
    ];
    await mockCompletionOnce(JSON.stringify({ candidates: withBadCategory }));
    const result = await generatePracticeCaseCandidates();
    expect(result).toHaveLength(7);
    expect(result.every((c) => (c.intendedCategory as string) !== "Vector Search")).toBe(true);
  });

  it("drops a candidate with an invalid difficulty rather than throwing", async () => {
    const withBadDifficulty = [
      ...mockCandidates.slice(0, 7),
      { rawInput: "Something vague.", industry: "Generic", intendedCategory: "Generation", difficulty: "extreme" },
    ];
    await mockCompletionOnce(JSON.stringify({ candidates: withBadDifficulty }));
    const result = await generatePracticeCaseCandidates();
    expect(result).toHaveLength(7);
  });

  it("throws when every candidate is invalid", async () => {
    await mockCompletionOnce(JSON.stringify({ candidates: [] }));
    await expect(generatePracticeCaseCandidates()).rejects.toThrow(/no usable/i);
  });

  it("throws a clear truncation error when finish_reason is 'length'", async () => {
    const { getGroqClient } = await import("@/lib/groq");
    vi.mocked(getGroqClient).mockReturnValueOnce({
      chat: {
        completions: {
          create: async () => ({
            choices: [{ finish_reason: "length", message: { content: '{"candidates": [' } }],
          }),
        },
      },
    } as never);
    await expect(generatePracticeCaseCandidates()).rejects.toThrow(/truncated/i);
  });
});
