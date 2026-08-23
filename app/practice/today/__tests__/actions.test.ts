import { describe, it, expect, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  user: null as { id: string } | null,
  practiceCase: null as Record<string, unknown> | null,
  solve: null as Record<string, unknown> | null,
  updated: [] as unknown[],
  filters: [] as unknown[],
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: async () => ({
    auth: { getUser: async () => ({ data: { user: state.user } }) },
    from: (table: string) => {
      if (table === "practice_cases") {
        return {
          select: () => ({
            eq: () => ({
              limit: () => ({
                single: async () => ({ data: state.practiceCase, error: null }),
              }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({
            single: async () => ({ data: state.solve, error: null }),
          }),
        }),
        update: (values: unknown) => {
          state.updated.push(values);
          return {
            eq: async (column: string, value: unknown) => {
              state.filters.push({ column, value });
              return { error: null };
            },
          };
        },
      };
    },
  }),
}));

const REVEAL = {
  match: true,
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

import { getTodaysPracticeCase, submitPracticeGuess } from "../actions";
import { recommendCategory } from "@/lib/engine/reveal";

beforeEach(() => {
  state.user = { id: "u1" };
  state.practiceCase = { id: "pc1", raw_input: "x", industry: null };
  state.solve = { raw_input: "A messy client ask.", industry: "Healthcare" };
  state.updated = [];
  state.filters = [];
  vi.clearAllMocks();
});

describe("getTodaysPracticeCase", () => {
  it("returns an active practice case", async () => {
    const result = await getTodaysPracticeCase();
    expect(result.id).toBe("pc1");
  });
});

describe("submitPracticeGuess", () => {
  it("reveals against the shared engine and persists guess + reveal together", async () => {
    const result = await submitPracticeGuess("s1", "RAG");

    expect(recommendCategory).toHaveBeenCalledWith({
      goal: "A messy client ask.",
      problemType: "A messy client ask.",
      guessedCategory: "RAG",
    });
    expect(result).toEqual(REVEAL);
    expect(state.updated).toEqual([
      {
        guessed_category: "RAG",
        revealed_category: "RAG",
        tool_class: "specialized",
        correct: true,
        why_it_fits: REVEAL.whyItFits,
        why_not_alternatives: REVEAL.whyNotAlternatives,
      },
    ]);
  });

  it("throws when there is no authenticated user, before writing", async () => {
    state.user = null;
    await expect(submitPracticeGuess("s1", "RAG")).rejects.toThrow(
      /not authenticated/i
    );
    expect(recommendCategory).not.toHaveBeenCalled();
    expect(state.updated).toEqual([]);
  });

  it("rejects a category that is not in the fixed taxonomy, before writing", async () => {
    await expect(submitPracticeGuess("s1", "Telepathy")).rejects.toThrow(
      /unknown category/i
    );
    expect(recommendCategory).not.toHaveBeenCalled();
    expect(state.updated).toEqual([]);
  });
});
