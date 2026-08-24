import { describe, it, expect, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  existingRawInputs: [] as string[],
  inserted: [] as Record<string, unknown>[],
}));

const CANDIDATES = [
  { rawInput: "A retailer wants fake reviews flagged before they go live.", industry: "Retail", intendedCategory: "Classification", difficulty: "easy" as const },
  { rawInput: "A hospital wants nurse questions answered from its handbook.", industry: "Healthcare", intendedCategory: "RAG", difficulty: "medium" as const },
];

vi.mock("../generate-cases", () => ({
  generatePracticeCaseCandidates: vi.fn(async () => CANDIDATES),
}));

vi.mock("../dedupe", () => ({
  dedupeCandidates: vi.fn((candidates: typeof CANDIDATES, existing: string[]) =>
    candidates.filter((c) => !existing.includes(c.rawInput))
  ),
}));

vi.mock("../validate-candidate", () => ({
  validateCandidate: vi.fn(async () => ({ valid: true })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdminClient: () => ({
    from: (table: string) => {
      if (table !== "practice_cases") throw new Error(`unexpected table: ${table}`);
      return {
        select: () => ({
          eq: () => ({
            then: (resolve: (v: { data: { raw_input: string }[]; error: null }) => unknown) =>
              Promise.resolve({
                data: state.existingRawInputs.map((raw_input) => ({ raw_input })),
                error: null,
              }).then(resolve),
          }),
        }),
        insert: (rows: Record<string, unknown>[]) => {
          state.inserted.push(...rows);
          return Promise.resolve({ error: null });
        },
      };
    },
  }),
}));

import { runContentPipeline } from "../run-pipeline";
import { validateCandidate } from "../validate-candidate";
import { dedupeCandidates } from "../dedupe";

beforeEach(() => {
  state.existingRawInputs = [];
  state.inserted = [];
  vi.clearAllMocks();
  vi.mocked(dedupeCandidates).mockImplementation((candidates: typeof CANDIDATES, existing: string[]) =>
    candidates.filter((c) => !existing.includes(c.rawInput))
  );
  vi.mocked(validateCandidate).mockResolvedValue({ valid: true });
});

describe("runContentPipeline", () => {
  it("inserts every generated candidate when nothing is filtered", async () => {
    const summary = await runContentPipeline();
    expect(summary).toEqual({ generated: 2, rejectedDuplicate: 0, rejectedValidation: 0, inserted: 2 });
    expect(state.inserted).toEqual([
      { raw_input: CANDIDATES[0].rawInput, industry: "Retail", difficulty: "easy" },
      { raw_input: CANDIDATES[1].rawInput, industry: "Healthcare", difficulty: "medium" },
    ]);
  });

  it("never writes the intended category to the database", async () => {
    await runContentPipeline();
    for (const row of state.inserted) {
      expect(row).not.toHaveProperty("intendedCategory");
      expect(row).not.toHaveProperty("category");
      expect(row).not.toHaveProperty("intended_category");
    }
  });

  it("counts a deduped candidate as rejectedDuplicate, not inserted", async () => {
    state.existingRawInputs = [CANDIDATES[0].rawInput];
    const summary = await runContentPipeline();
    expect(summary).toEqual({ generated: 2, rejectedDuplicate: 1, rejectedValidation: 0, inserted: 1 });
    expect(state.inserted).toHaveLength(1);
    expect(state.inserted[0].raw_input).toBe(CANDIDATES[1].rawInput);
  });

  it("counts a validation-rejected candidate as rejectedValidation, not inserted", async () => {
    vi.mocked(validateCandidate)
      .mockResolvedValueOnce({ valid: false, reason: "ambiguous" })
      .mockResolvedValueOnce({ valid: true });
    const summary = await runContentPipeline();
    expect(summary).toEqual({ generated: 2, rejectedDuplicate: 0, rejectedValidation: 1, inserted: 1 });
    expect(state.inserted).toHaveLength(1);
    expect(state.inserted[0].raw_input).toBe(CANDIDATES[1].rawInput);
  });

  it("validates candidates sequentially, never with Promise.all", async () => {
    const callOrder: number[] = [];
    vi.mocked(validateCandidate).mockImplementation(async (candidate) => {
      const index = CANDIDATES.findIndex((c) => c.rawInput === candidate.rawInput);
      callOrder.push(index);
      // If run in parallel, the second call could start before this resolves.
      await new Promise((resolve) => setTimeout(resolve, 5));
      return { valid: true };
    });
    await runContentPipeline();
    expect(callOrder).toEqual([0, 1]);
  });
});
