import { describe, it, expect, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  user: null as { id: string } | null,
  solve: null as Record<string, unknown> | null,
  existingTakeaway: null as Record<string, unknown> | null,
  inserted: [] as unknown[],
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: async () => ({
    auth: { getUser: async () => ({ data: { user: state.user } }) },
    from: (table: string) => {
      if (table === "solves") {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: state.solve, error: null }),
            }),
          }),
        };
      }
      // takeaways
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: state.existingTakeaway, error: null }),
          }),
        }),
        insert: (values: unknown) => {
          state.inserted.push(values);
          return Promise.resolve({ error: null });
        },
      };
    },
  }),
}));

const DRAFT_TEXT =
  "Here's how we'll tackle churn: a prediction model flags at-risk accounts early so the team can step in before they cancel.";

vi.mock("@/lib/engine/handback", () => ({
  generateHandback: vi.fn(async () => DRAFT_TEXT),
}));

import { createHandback } from "../actions";
import { generateHandback } from "@/lib/engine/handback";

beforeEach(() => {
  state.user = { id: "u1" };
  state.solve = {
    goal: "Reduce churn",
    problem_type: "Predict cancellations",
    revealed_category: "Prediction",
  };
  state.existingTakeaway = null;
  state.inserted = [];
  vi.clearAllMocks();
});

describe("createHandback", () => {
  it("generates and persists a draft for an authenticated, revealed solve", async () => {
    const text = await createHandback("s1");

    expect(generateHandback).toHaveBeenCalledWith({
      goal: "Reduce churn",
      problemType: "Predict cancellations",
      revealedCategory: "Prediction",
    });
    expect(text).toBe(DRAFT_TEXT);
    expect(state.inserted).toEqual([
      { solve_id: "s1", draft_text: DRAFT_TEXT },
    ]);
  });

  it("throws when there is no authenticated user, before reading or writing", async () => {
    state.user = null;
    await expect(createHandback("s1")).rejects.toThrow(/not authenticated/i);
    expect(generateHandback).not.toHaveBeenCalled();
    expect(state.inserted).toEqual([]);
  });

  it("refuses to generate a handback before the solve has been revealed", async () => {
    state.solve = {
      goal: "Reduce churn",
      problem_type: "Predict cancellations",
      revealed_category: null,
    };
    await expect(createHandback("s1")).rejects.toThrow(/reveal/i);
    expect(generateHandback).not.toHaveBeenCalled();
    expect(state.inserted).toEqual([]);
  });

  it("does not write anything when generation fails", async () => {
    vi.mocked(generateHandback).mockRejectedValueOnce(new Error("groq is down"));
    await expect(createHandback("s1")).rejects.toThrow(/groq is down/);
    expect(state.inserted).toEqual([]);
  });
});
