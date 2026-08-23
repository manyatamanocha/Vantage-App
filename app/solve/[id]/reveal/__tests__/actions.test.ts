import { describe, it, expect, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  user: null as { id: string } | null,
  solve: null as Record<string, unknown> | null,
  updated: [] as unknown[],
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: async () => ({
    auth: { getUser: async () => ({ data: { user: state.user } }) },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: state.solve, error: null }),
        }),
      }),
      update: (values: unknown) => {
        state.updated.push(values);
        return { eq: async () => ({ error: null }) };
      },
    }),
  }),
}));

const REVEAL = {
  match: false,
  revealedCategory: "RAG",
  whyItFits: "They need answers traceable to their own contracts.",
  whyNotAlternatives: [
    { category: "Classification", reason: "There is no fixed label set here." },
  ],
  toolClass: "specialized" as const,
};

vi.mock("@/lib/engine/reveal", () => ({
  recommendCategory: vi.fn(async () => REVEAL),
}));

import { runRevealStep } from "../actions";
import { recommendCategory } from "@/lib/engine/reveal";

beforeEach(() => {
  state.user = { id: "u1" };
  state.solve = {
    goal: "Answer questions from internal contracts",
    problem_type: "Doc Q&A",
    guessed_category: "Classification",
  };
  state.updated = [];
  vi.clearAllMocks();
});

describe("runRevealStep", () => {
  it("reveals the category and persists the verdict for an authenticated user", async () => {
    const result = await runRevealStep("s1");

    expect(recommendCategory).toHaveBeenCalledWith({
      goal: "Answer questions from internal contracts",
      problemType: "Doc Q&A",
      guessedCategory: "Classification",
    });
    expect(result).toEqual(REVEAL);
    expect(state.updated).toEqual([
      { revealed_category: "RAG", tool_class: "specialized", correct: false },
    ]);
  });

  it("throws when there is no authenticated user, before reading or writing", async () => {
    state.user = null;
    await expect(runRevealStep("s1")).rejects.toThrow(/not authenticated/i);
    expect(recommendCategory).not.toHaveBeenCalled();
    expect(state.updated).toEqual([]);
  });

  it("refuses to reveal before a guess is recorded", async () => {
    state.solve = {
      goal: "Answer questions from internal contracts",
      problem_type: "Doc Q&A",
      guessed_category: null,
    };
    await expect(runRevealStep("s1")).rejects.toThrow(/guess/i);
    expect(recommendCategory).not.toHaveBeenCalled();
    expect(state.updated).toEqual([]);
  });

  it("refuses to reveal before the problem has been structured", async () => {
    state.solve = { goal: null, problem_type: null, guessed_category: "RAG" };
    await expect(runRevealStep("s1")).rejects.toThrow(/structur/i);
    expect(recommendCategory).not.toHaveBeenCalled();
    expect(state.updated).toEqual([]);
  });

  it("does not write anything when the reveal call fails", async () => {
    vi.mocked(recommendCategory).mockRejectedValueOnce(new Error("groq is down"));
    await expect(runRevealStep("s1")).rejects.toThrow(/groq is down/);
    // Input persisted by the earlier steps must survive a failed reveal.
    expect(state.updated).toEqual([]);
  });
});
