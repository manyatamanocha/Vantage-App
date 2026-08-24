import { describe, it, expect, vi } from "vitest";
import { createDraftSolve } from "../actions";

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
