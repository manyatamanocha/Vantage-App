import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

type Row = Record<string, unknown>;

const state = vi.hoisted(() => ({
  user: null as { id: string } | null,
  settings: [] as Row[],
  practiceCases: [] as Row[],
  inserted: [] as Row[],
}));

/**
 * A small stand-in for PostgREST's query builder rather than a per-call stub:
 * `getTodaysPracticeCase` chains filters in an order that depends on its own
 * branching (difficulty applied or not), so a stub shaped around one exact call
 * sequence would pass while proving nothing about which rows are selected.
 * This applies the filters for real against in-memory rows, so the assertions
 * below are about the actual candidate set.
 */
function makeBuilder(rows: Row[]) {
  let current = [...rows];
  const builder = {
    select: () => builder,
    eq: (column: string, value: unknown) => {
      current = current.filter((row) => row[column] === value);
      return builder;
    },
    order: (column: string) => {
      current = [...current].sort((a, b) =>
        String(a[column]).localeCompare(String(b[column]))
      );
      return builder;
    },
    single: async () => ({
      data: current[0] ?? null,
      error: current.length ? null : { message: "No rows found" },
    }),
    maybeSingle: async () => ({ data: current[0] ?? null, error: null }),
    then: (
      resolve: (value: { data: Row[]; error: null }) => unknown,
      reject?: (reason: unknown) => unknown
    ) => Promise.resolve({ data: current, error: null }).then(resolve, reject),
  };
  return builder;
}

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: async () => ({
    auth: { getUser: async () => ({ data: { user: state.user } }) },
    from: (table: string) => {
      if (table === "user_settings") return makeBuilder(state.settings);
      if (table === "practice_cases") return makeBuilder(state.practiceCases);
      // solves
      return {
        insert: (values: Row) => {
          state.inserted.push(values);
          return {
            select: () => ({
              single: async () => ({ data: { id: "new-solve" }, error: null }),
            }),
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

function practiceCase(id: string, difficulty: string, extra: Row = {}): Row {
  return {
    id,
    raw_input: `Case ${id}`,
    industry: null,
    difficulty,
    active: true,
    ...extra,
  };
}

beforeEach(() => {
  state.user = { id: "u1" };
  state.settings = [];
  state.practiceCases = [
    practiceCase("e1", "easy"),
    practiceCase("e2", "easy"),
    practiceCase("m1", "medium"),
    practiceCase("m2", "medium"),
    practiceCase("m3", "medium"),
    practiceCase("h1", "hard"),
    practiceCase("h2", "hard"),
  ];
  state.inserted = [];
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("getTodaysPracticeCase", () => {
  it("filters to the user's configured practice difficulty", async () => {
    state.settings = [{ user_id: "u1", practice_difficulty: "hard" }];
    const result = await getTodaysPracticeCase();
    expect(result.difficulty).toBe("hard");
    expect(result.matchedPreferredDifficulty).toBe(true);
  });

  it("falls back to 'medium' when the user has no settings row at all", async () => {
    state.settings = [];
    const result = await getTodaysPracticeCase();
    expect(result.difficulty).toBe("medium");
  });

  it("returns the same case on repeated calls within the same day", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-23T09:00:00.000Z"));
    const morning = await getTodaysPracticeCase();
    vi.setSystemTime(new Date("2026-08-23T22:45:00.000Z"));
    const evening = await getTodaysPracticeCase();
    expect(evening.id).toBe(morning.id);
  });

  it("does not hand every user the same case on the same day", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-23T09:00:00.000Z"));
    const ids = new Set<string>();
    for (let i = 0; i < 20; i += 1) {
      state.user = { id: `user-${i}` };
      ids.add((await getTodaysPracticeCase()).id);
    }
    expect(ids.size).toBeGreaterThan(1);
  });

  it("widens to any active case when nothing is seeded at the preferred difficulty", async () => {
    state.settings = [{ user_id: "u1", practice_difficulty: "hard" }];
    state.practiceCases = [practiceCase("m1", "medium")];
    const result = await getTodaysPracticeCase();
    expect(result.id).toBe("m1");
    expect(result.matchedPreferredDifficulty).toBe(false);
  });

  it("never returns an inactive case", async () => {
    state.practiceCases = [
      practiceCase("m1", "medium", { active: false }),
      practiceCase("m2", "medium"),
    ];
    for (let i = 0; i < 20; i += 1) {
      state.user = { id: `user-${i}` };
      expect((await getTodaysPracticeCase()).id).toBe("m2");
    }
  });

  it("throws a seeding-specific error when the pool is empty", async () => {
    state.practiceCases = [];
    await expect(getTodaysPracticeCase()).rejects.toThrow(/no practice cases/i);
  });

  it("throws when there is no authenticated user", async () => {
    state.user = null;
    await expect(getTodaysPracticeCase()).rejects.toThrow(/not authenticated/i);
  });
});

describe("submitPracticeGuess", () => {
  it("creates the solve row only now, with guess and reveal written together", async () => {
    const result = await submitPracticeGuess("m1", "RAG");

    expect(recommendCategory).toHaveBeenCalledWith({
      goal: "Case m1",
      problemType: "Case m1",
      guessedCategory: "RAG",
    });
    expect(result).toEqual({ ...REVEAL, solveId: "new-solve" });
    expect(state.inserted).toEqual([
      {
        user_id: "u1",
        source: "practice",
        raw_input: "Case m1",
        industry: null,
        guessed_category: "RAG",
        revealed_category: "RAG",
        tool_class: "specialized",
        correct: true,
        why_it_fits: REVEAL.whyItFits,
        why_not_alternatives: REVEAL.whyNotAlternatives,
      },
    ]);
  });

  it("reads the scenario from the curated table rather than trusting the caller", async () => {
    // The action takes a practice_case id, not the case text, so a hand-rolled
    // POST cannot put arbitrary prose in front of the model or into `solves`.
    await submitPracticeGuess("h2", "Classification");
    expect(recommendCategory).toHaveBeenCalledWith(
      expect.objectContaining({ goal: "Case h2" })
    );
    expect(state.inserted[0].raw_input).toBe("Case h2");
  });

  it("writes nothing when the reveal fails", async () => {
    vi.mocked(recommendCategory).mockRejectedValueOnce(new Error("groq is down"));
    await expect(submitPracticeGuess("m1", "RAG")).rejects.toThrow(/groq is down/);
    expect(state.inserted).toEqual([]);
  });

  it("throws when there is no authenticated user, before writing", async () => {
    state.user = null;
    await expect(submitPracticeGuess("m1", "RAG")).rejects.toThrow(
      /not authenticated/i
    );
    expect(recommendCategory).not.toHaveBeenCalled();
    expect(state.inserted).toEqual([]);
  });

  it("rejects a category that is not in the fixed taxonomy, before writing", async () => {
    await expect(submitPracticeGuess("m1", "Telepathy")).rejects.toThrow(
      /unknown category/i
    );
    expect(recommendCategory).not.toHaveBeenCalled();
    expect(state.inserted).toEqual([]);
  });
});
