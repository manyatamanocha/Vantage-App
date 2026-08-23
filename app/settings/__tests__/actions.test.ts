import { describe, it, expect, vi } from "vitest";

const updateMock = vi.fn(async () => ({ error: null }));
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: "u1" } } }),
    },
    from: () => ({ update: (patch: any) => ({ eq: updateMock }) }),
  }),
}));

import { updateSettings } from "../actions";

describe("updateSettings", () => {
  it("writes the provided patch", async () => {
    await updateSettings("u1", { practiceDifficulty: "hard" });
    expect(updateMock).toHaveBeenCalled();
  });
});
