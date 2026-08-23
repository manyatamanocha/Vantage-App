import { describe, it, expect, vi, beforeEach } from "vitest";

type Row = Record<string, unknown>;

const state = vi.hoisted(() => ({
  user: null as { id: string } | null,
  solves: [] as Row[],
  updated: [] as unknown[],
  filters: [] as unknown[],
}));

/**
 * `saveGuess`'s update is conditional in the database (`.is("revealed_category",
 * null)`), so the interesting behaviour is which rows the filters actually
 * match. This fake applies `.eq`/`.is` against in-memory rows and returns the
 * matched set from `.select()`, exactly as PostgREST does — a stub that always
 * returned one row would report the guard as working whether or not it was.
 */
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: async () => ({
    auth: { getUser: async () => ({ data: { user: state.user } }) },
    from: () => ({
      update: (values: Row) => {
        state.updated.push(values);
        let matched = [...state.solves];
        const builder = {
          eq: (column: string, value: unknown) => {
            state.filters.push({ column, value });
            matched = matched.filter((row) => row[column] === value);
            return builder;
          },
          is: (column: string, value: unknown) => {
            state.filters.push({ column, value });
            matched = matched.filter((row) => (row[column] ?? null) === value);
            return builder;
          },
          select: async () => {
            for (const row of matched) Object.assign(row, values);
            return { data: matched.map((row) => ({ id: row.id })), error: null };
          },
        };
        return builder;
      },
    }),
  }),
}));

import { saveGuess } from "../actions";

beforeEach(() => {
  state.user = { id: "u1" };
  state.solves = [
    { id: "s1", guessed_category: null, revealed_category: null },
    { id: "revealed", guessed_category: "RAG", revealed_category: "Prediction" },
  ];
  state.updated = [];
  state.filters = [];
});

describe("saveGuess", () => {
  it("persists the guessed category on the solve for an authenticated user", async () => {
    await saveGuess("s1", "Classification");
    expect(state.updated).toEqual([{ guessed_category: "Classification" }]);
    expect(state.filters).toEqual([
      { column: "id", value: "s1" },
      { column: "revealed_category", value: null },
    ]);
    expect(state.solves[0].guessed_category).toBe("Classification");
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

  it("refuses to overwrite the guess once the solve has been revealed", async () => {
    // Navigating Back to /guess after the reveal and locking in a different
    // answer used to succeed silently, leaving `correct` (computed at reveal
    // time) contradicting the stored guess.
    await expect(saveGuess("revealed", "Classification")).rejects.toThrow(
      /already been revealed/i
    );
    expect(state.solves[1].guessed_category).toBe("RAG");
  });

  it("reports a solve that isn't the user's (or doesn't exist) rather than succeeding silently", async () => {
    await expect(saveGuess("someone-elses-solve", "Classification")).rejects.toThrow(
      /wasn't saved/i
    );
  });
});
