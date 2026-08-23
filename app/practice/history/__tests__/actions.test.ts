import { describe, it, expect, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  user: null as { id: string } | null,
  rows: [] as unknown[],
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: async () => ({
    auth: { getUser: async () => ({ data: { user: state.user } }) },
    from: () => ({
      select: () => ({
        eq: () => ({
          order: async () => ({ data: state.rows, error: null }),
        }),
      }),
    }),
  }),
}));

import { listSolves } from "../actions";

beforeEach(() => {
  state.user = { id: "u1" };
  state.rows = [
    {
      id: "s1",
      source: "live",
      revealed_category: "RAG",
      correct: true,
      created_at: "2026-08-01T00:00:00Z",
    },
  ];
});

describe("listSolves", () => {
  it("maps db rows to camelCase history rows", async () => {
    const result = await listSolves("u1");
    expect(result[0]).toEqual({
      id: "s1",
      source: "live",
      revealedCategory: "RAG",
      correct: true,
      createdAt: "2026-08-01T00:00:00Z",
    });
  });

  it("throws when there is no authenticated user, before querying", async () => {
    state.user = null;
    await expect(listSolves("u1")).rejects.toThrow(/not authenticated/i);
  });
});
