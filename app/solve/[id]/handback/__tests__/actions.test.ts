import { describe, it, expect, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  user: null as { id: string } | null,
  solve: null as Record<string, unknown> | null,
  existingTakeaway: null as Record<string, unknown> | null,
  // Simulates the real `takeaways` table's unique constraint on `solve_id`
  // (supabase/migrations/0003_takeaways_unique_solve.sql): keyed by solve_id
  // so an upsert with onConflict: "solve_id" replaces the existing entry
  // instead of appending a second row.
  takeawaysBySolve: new Map<string, Record<string, unknown>>(),
  upsertCalls: [] as { values: Record<string, unknown>; options: unknown }[],
}));

vi.mock("@/lib/supabase/server", () => {
  const buildClient = () => ({
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
        upsert: (values: Record<string, unknown>, options: unknown) => {
          state.upsertCalls.push({ values, options });
          state.takeawaysBySolve.set(values.solve_id as string, values);
          return Promise.resolve({ error: null });
        },
      };
    },
  });
  return {
    getSupabaseServerClient: async () => buildClient(),
    getVerifiedUser: async () => ({ supabase: buildClient(), user: state.user }),
  };
});

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
    raw_input: "Our best customers keep quietly leaving and we find out too late.",
    goal: "Reduce churn",
    problem_type: "Predict cancellations",
    revealed_category: "Prediction",
  };
  state.existingTakeaway = null;
  state.takeawaysBySolve = new Map();
  state.upsertCalls = [];
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
    expect(state.upsertCalls).toHaveLength(1);
    expect(state.upsertCalls[0].values).toMatchObject({
      solve_id: "s1",
      draft_text: DRAFT_TEXT,
    });
    expect(state.upsertCalls[0].options).toEqual({ onConflict: "solve_id" });
  });

  it("falls back to raw_input for a practice-sourced solve, whose goal/problem_type are always NULL", async () => {
    // The daily practice loop skips the structuring step entirely, so nothing
    // ever writes `goal`/`problem_type` on a `source: "practice"` row. Those
    // NULLs used to go straight into the prompt as "Goal: null" — in the one
    // output the consultant hands to a client.
    const PRACTICE_RAW_INPUT =
      "A payments processor wants unusual transaction patterns surfaced for human review.";
    state.solve = {
      raw_input: PRACTICE_RAW_INPUT,
      goal: null,
      problem_type: null,
      revealed_category: "Anomaly Detection",
    };

    const text = await createHandback("practice-solve");

    expect(generateHandback).toHaveBeenCalledWith({
      goal: PRACTICE_RAW_INPUT,
      problemType: PRACTICE_RAW_INPUT,
      revealedCategory: "Anomaly Detection",
    });
    expect(text).toBe(DRAFT_TEXT);
    expect(state.upsertCalls).toHaveLength(1);
  });

  it("throws when there is no authenticated user, before reading or writing", async () => {
    state.user = null;
    await expect(createHandback("s1")).rejects.toThrow(/not authenticated/i);
    expect(generateHandback).not.toHaveBeenCalled();
    expect(state.upsertCalls).toEqual([]);
  });

  it("refuses to generate a handback before the solve has been revealed", async () => {
    state.solve = {
      raw_input: "Our best customers keep quietly leaving and we find out too late.",
      goal: "Reduce churn",
      problem_type: "Predict cancellations",
      revealed_category: null,
    };
    await expect(createHandback("s1")).rejects.toThrow(/reveal/i);
    expect(generateHandback).not.toHaveBeenCalled();
    expect(state.upsertCalls).toEqual([]);
  });

  it("does not write anything when generation fails", async () => {
    vi.mocked(generateHandback).mockRejectedValueOnce(new Error("groq is down"));
    await expect(createHandback("s1")).rejects.toThrow(/groq is down/);
    expect(state.upsertCalls).toEqual([]);
  });

  it("upserts on solve_id: a second call for the same solve results in exactly one row, and its draft text replaces the first's", async () => {
    const SECOND_DRAFT = "A revised draft: the retrieval system now surfaces the right accounts first.";

    await createHandback("s1");
    vi.mocked(generateHandback).mockResolvedValueOnce(SECOND_DRAFT);
    const secondText = await createHandback("s1");

    expect(secondText).toBe(SECOND_DRAFT);
    // Both calls upserted on the same conflict target, so the simulated table
    // (keyed by solve_id) ends up with exactly one row for this solve.
    expect(state.upsertCalls).toHaveLength(2);
    for (const call of state.upsertCalls) {
      expect(call.options).toEqual({ onConflict: "solve_id" });
    }
    expect(state.takeawaysBySolve.size).toBe(1);
    expect(state.takeawaysBySolve.get("s1")).toMatchObject({
      solve_id: "s1",
      draft_text: SECOND_DRAFT,
    });
  });

  it("sends a fresh generated_at on each call rather than preserving a stale timestamp", async () => {
    await createHandback("s1");
    const firstGeneratedAt = state.upsertCalls[0].values.generated_at;

    await new Promise((resolve) => setTimeout(resolve, 5));
    await createHandback("s1");
    const secondGeneratedAt = state.upsertCalls[1].values.generated_at;

    expect(typeof firstGeneratedAt).toBe("string");
    expect(typeof secondGeneratedAt).toBe("string");
    expect(secondGeneratedAt).not.toBe(firstGeneratedAt);
  });
});
