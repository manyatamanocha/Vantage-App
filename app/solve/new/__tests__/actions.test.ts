import { describe, it, expect, vi, beforeEach } from "vitest";
import { createDraftSolve, refineAsk } from "../actions";
import { AskRefusedError, REFUSED_ASK_MESSAGE } from "@/lib/engine/structure";

// The real AskRefusedError is kept — refineAsk's whole job here is telling
// that one error apart from every other, so stubbing it would test nothing.
vi.mock("@/lib/engine/structure", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/engine/structure")>()),
  structureProblem: vi.fn(),
}));

vi.mock("@/lib/analytics/track", () => ({ track: vi.fn() }));

vi.mock("@/lib/supabase/server", () => {
  const buildClient = () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
    from: () => ({
      insert: () => ({
        select: () => ({
          single: async () => ({ data: { id: "s1" }, error: null }),
        }),
      }),
    }),
  });
  return {
    getSupabaseServerClient: async () => buildClient(),
    getVerifiedUser: async () => ({ supabase: buildClient(), user: { id: "u1" } }),
  };
});

describe("createDraftSolve", () => {
  it("returns the new solve id", async () => {
    const result = await createDraftSolve({ rawInput: "client wants churn prediction", source: "live" });
    expect(result.solveId).toBe("s1");
  });

  it("rejects empty raw input", async () => {
    await expect(createDraftSolve({ rawInput: "", source: "live" })).rejects.toThrow(/raw input/i);
  });
});

describe("refineAsk", () => {
  beforeEach(() => vi.clearAllMocks());

  async function mockedStructureProblem() {
    return vi.mocked((await import("@/lib/engine/structure")).structureProblem);
  }

  it("returns the structured ask when the model accepts it", async () => {
    (await mockedStructureProblem()).mockResolvedValue({
      goal: "Reduce churn",
      problemType: "Prediction",
    });

    const result = await refineAsk("who will cancel next quarter");

    expect(result).toEqual({ refused: false, goal: "Reduce churn", problemType: "Prediction" });
  });

  // A thrown server action reaches the browser as a redacted generic message
  // in production, so a refusal has to come back as a RETURNED value — throwing
  // would leave the intake screen unable to tell "declined" from "crashed",
  // which is the whole bug being fixed.
  it("returns a refusal rather than throwing when the ask is declined", async () => {
    (await mockedStructureProblem()).mockRejectedValue(new AskRefusedError("harmful ask"));

    const result = await refineAsk("how do i read my coworkers emails");

    expect(result).toEqual({ refused: true, message: REFUSED_ASK_MESSAGE });
  });

  it("records ask_refused so refusals show up in analytics", async () => {
    (await mockedStructureProblem()).mockRejectedValue(new AskRefusedError("harmful ask"));
    const { track } = await import("@/lib/analytics/track");

    await refineAsk("how do i read my coworkers emails");

    expect(vi.mocked(track).mock.calls.map((call) => call[0])).toContain("ask_refused");
  });

  // The opposite failure: masking a real outage as "we won't answer that"
  // would hide genuine breakage from both the user and the logs.
  it("still throws when the model fails for an ordinary reason", async () => {
    (await mockedStructureProblem()).mockRejectedValue(new Error("groq is down"));

    await expect(refineAsk("who will cancel next quarter")).rejects.toThrow(/groq is down/);
  });
});
