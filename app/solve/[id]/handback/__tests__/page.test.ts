import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const state = vi.hoisted(() => ({
  solve: null as Record<string, unknown> | null,
  takeaway: null as Record<string, unknown> | null,
  selected: [] as string[],
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: async () => ({
    from: (table: string) => {
      if (table === "solves") {
        return {
          select: (columns: string) => {
            state.selected.push(columns);
            return {
              eq: () => ({ single: async () => ({ data: state.solve, error: null }) }),
            };
          },
        };
      }
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: state.takeaway, error: null }),
          }),
        }),
      };
    },
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) =>
    createElement("a", { href }, children),
}));

const FRESH_DRAFT =
  "Heres how well tackle churn: a prediction model flags at-risk accounts early.";

vi.mock("../actions", () => ({
  createHandback: vi.fn(async () => FRESH_DRAFT),
}));

vi.mock("../handback-viewer", () => ({
  HandbackViewer: ({ draftText }: { draftText: string }) =>
    createElement("div", { "data-testid": "viewer" }, draftText),
}));

import HandbackPage from "../page";
import { createHandback } from "../actions";

const render = async (id = "s1") =>
  renderToStaticMarkup(await HandbackPage({ params: Promise.resolve({ id }) }));

beforeEach(() => {
  state.selected = [];
  vi.clearAllMocks();
});

describe("HandbackPage", () => {
  it("generates the draft once when no takeaway exists yet", async () => {
    state.solve = { revealed_category: "Prediction" };
    state.takeaway = null;

    const html = await render();

    expect(createHandback).toHaveBeenCalledTimes(1);
    expect(createHandback).toHaveBeenCalledWith("s1");
    expect(html).toContain(FRESH_DRAFT);
  });

  it("hydrates from the persisted draft instead of calling Groq again", async () => {
    state.solve = { revealed_category: "Prediction" };
    state.takeaway = { draft_text: "Already generated draft text." };

    const html = await render();

    expect(createHandback).not.toHaveBeenCalled();
    expect(html).toContain("Already generated draft text.");
  });

  it("redirects to the reveal screen when the solve hasn't been revealed yet", async () => {
    state.solve = { revealed_category: null };
    state.takeaway = null;

    await expect(render()).rejects.toThrow("REDIRECT:/solve/s1/reveal");
    expect(createHandback).not.toHaveBeenCalled();
  });
});
