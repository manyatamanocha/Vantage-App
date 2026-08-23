import { describe, it, expect, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  user: null as { id: string } | null,
  updated: [] as unknown[],
  filters: [] as unknown[],
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: async () => ({
    auth: { getUser: async () => ({ data: { user: state.user } }) },
    from: () => ({
      update: (values: unknown) => {
        state.updated.push(values);
        return {
          eq: async (column: string, value: unknown) => {
            state.filters.push({ column, value });
            return { error: null };
          },
        };
      },
    }),
  }),
}));

import { saveGuess } from "../actions";

beforeEach(() => {
  state.user = { id: "u1" };
  state.updated = [];
  state.filters = [];
});

describe("saveGuess", () => {
  it("persists the guessed category on the solve for an authenticated user", async () => {
    await saveGuess("s1", "Classification");
    expect(state.updated).toEqual([{ guessed_category: "Classification" }]);
    expect(state.filters).toEqual([{ column: "id", value: "s1" }]);
  });

  it("throws when there is no authenticated user, before writing", async () => {
    state.user = null;
    await expect(saveGuess("s1", "Classification")).rejects.toThrow(
      /not authenticated/i
    );
    expect(state.updated).toEqual([]);
  });

  it("rejects a category that is not in the fixed taxonomy, before writing", async () => {
    await expect(saveGuess("s1", "Telepathy")).rejects.toThrow(
      /unknown category/i
    );
    expect(state.updated).toEqual([]);
  });
});
