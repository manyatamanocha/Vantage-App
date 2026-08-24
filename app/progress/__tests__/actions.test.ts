import { describe, it, expect, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  user: null as { id: string } | null,
  data: [] as unknown[],
}));

vi.mock("@/lib/supabase/server", () => {
  const buildClient = () => ({
    auth: { getUser: async () => ({ data: { user: state.user } }) },
    from: () => ({
      select: () => ({
        eq: async () => ({
          data: state.data,
          error: null,
        }),
      }),
    }),
  });
  return {
    getSupabaseServerClient: async () => buildClient(),
    getVerifiedUser: async () => ({ supabase: buildClient(), user: state.user }),
  };
});

import { getProgressStats } from "../actions";

beforeEach(() => {
  state.user = { id: "u1" };
  state.data = [
    { revealed_category: "Classification", correct: true },
    { revealed_category: "Classification", correct: false },
    { revealed_category: "RAG", correct: true },
    // Abandoned solve with null values - should be excluded
    { revealed_category: null, correct: null },
  ];
  vi.clearAllMocks();
});

describe("getProgressStats", () => {
  it("computes overall and per-category accuracy", async () => {
    const result = await getProgressStats("u1");
    // 2 correct out of 3 complete solves (abandoned row excluded)
    expect(result.firstGuessAccuracy).toBeCloseTo(2 / 3);
    // Classification: 1 correct out of 2
    expect(result.byCategory["Classification"]).toBeCloseTo(0.5);
    // RAG: 1 correct out of 1
    expect(result.byCategory["RAG"]).toBeCloseTo(1);
  });

  it("excludes abandoned solves (where correct is null) from accuracy calculation", async () => {
    // Only one complete solve (correct)
    state.data = [
      { revealed_category: "Classification", correct: true },
      // Abandoned solves
      { revealed_category: null, correct: null },
      { revealed_category: "RAG", correct: null },
    ];

    const result = await getProgressStats("u1");
    // Only 1 complete solve counted: 1 correct out of 1
    expect(result.firstGuessAccuracy).toBe(1);
    expect(result.byCategory["Classification"]).toBe(1);
    expect(Object.keys(result.byCategory)).not.toContain("RAG");
  });

  it("throws when there is no authenticated user", async () => {
    state.user = null;
    await expect(getProgressStats("u1")).rejects.toThrow(/not authenticated/i);
  });

  it("returns 0 accuracy when there are no complete solves", async () => {
    state.data = [
      { revealed_category: null, correct: null },
      { revealed_category: "Classification", correct: null },
    ];

    const result = await getProgressStats("u1");
    expect(result.firstGuessAccuracy).toBe(0);
    expect(Object.keys(result.byCategory).length).toBe(0);
    expect(result.completedCount).toBe(0);
  });

  it("distinguishes between zero completed solves and zero accuracy on completed solves", async () => {
    // Multiple completed solves, all incorrect
    state.data = [
      { revealed_category: "Classification", correct: false },
      { revealed_category: "RAG", correct: false },
      { revealed_category: "Chemistry", correct: false },
    ];

    const result = await getProgressStats("u1");
    // All three solves were incorrect, so accuracy should be 0
    expect(result.firstGuessAccuracy).toBe(0);
    // But completedCount should be 3, not 0
    expect(result.completedCount).toBe(3);
    // Each category should have 0% accuracy
    expect(result.byCategory["Classification"]).toBe(0);
    expect(result.byCategory["RAG"]).toBe(0);
    expect(result.byCategory["Chemistry"]).toBe(0);
  });
});
