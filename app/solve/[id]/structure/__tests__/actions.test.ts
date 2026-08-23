import { describe, it, expect, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  user: null as { id: string } | null,
  updated: [] as unknown[],
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: async () => ({
    auth: { getUser: async () => ({ data: { user: state.user } }) },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: { raw_input: "who will cancel?", industry: "SaaS" },
            error: null,
          }),
        }),
      }),
      update: (values: unknown) => {
        state.updated.push(values);
        return { eq: async () => ({ error: null }) };
      },
    }),
  }),
}));

vi.mock("@/lib/engine/structure", () => ({
  structureProblem: vi.fn(async () => ({
    goal: "Reduce churn",
    problemType: "Predict which customers will cancel",
  })),
}));

import { runStructureStep, editStructure } from "../actions";
import { structureProblem } from "@/lib/engine/structure";

beforeEach(() => {
  state.user = { id: "u1" };
  state.updated = [];
  vi.clearAllMocks();
});

describe("runStructureStep", () => {
  it("structures the problem and persists it for an authenticated user", async () => {
    const result = await runStructureStep("s1");
    expect(result).toEqual({
      goal: "Reduce churn",
      problemType: "Predict which customers will cancel",
    });
    expect(state.updated).toEqual([
      { goal: "Reduce churn", problem_type: "Predict which customers will cancel" },
    ]);
  });

  it("throws when there is no authenticated user, before reading or writing", async () => {
    state.user = null;
    await expect(runStructureStep("s1")).rejects.toThrow(/not authenticated/i);
    expect(structureProblem).not.toHaveBeenCalled();
    expect(state.updated).toEqual([]);
  });
});

describe("editStructure", () => {
  it("persists the corrected values for an authenticated user", async () => {
    await editStructure("s1", "Cut churn", "Churn classification");
    expect(state.updated).toEqual([
      { goal: "Cut churn", problem_type: "Churn classification" },
    ]);
  });

  it("throws when there is no authenticated user, before writing", async () => {
    state.user = null;
    await expect(
      editStructure("s1", "Cut churn", "Churn classification")
    ).rejects.toThrow(/not authenticated/i);
    expect(state.updated).toEqual([]);
  });
});
