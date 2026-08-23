import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const state = vi.hoisted(() => ({
  solve: null as Record<string, unknown> | null,
  selected: [] as string[],
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: async () => ({
    from: () => ({
      select: (columns: string) => {
        state.selected.push(columns);
        return {
          eq: () => ({ single: async () => ({ data: state.solve, error: null }) }),
        };
      },
    }),
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

const FRESH_REVEAL = {
  match: false,
  revealedCategory: "RAG",
  whyItFits: "Their answers have to be traceable to their own contracts.",
  whyNotAlternatives: [
    { category: "Classification", reason: "There is no fixed label set here." },
  ],
  toolClass: "specialized" as const,
};

vi.mock("../actions", () => ({
  runRevealStep: vi.fn(async () => FRESH_REVEAL),
}));

import RevealPage from "../page";
import { runRevealStep } from "../actions";

const render = async (id = "s1") =>
  renderToStaticMarkup(await RevealPage({ params: Promise.resolve({ id }) }));

beforeEach(() => {
  state.selected = [];
  vi.clearAllMocks();
});

describe("RevealPage", () => {
  it("runs the reveal once when the solve has not been revealed yet", async () => {
    state.solve = {
      guessed_category: "Classification",
      revealed_category: null,
      tool_class: null,
      correct: null,
      why_it_fits: null,
      why_not_alternatives: null,
    };

    const html = await render();

    expect(runRevealStep).toHaveBeenCalledTimes(1);
    expect(runRevealStep).toHaveBeenCalledWith("s1");
    expect(html).toContain("Not quite.");
    expect(html).toContain(FRESH_REVEAL.whyItFits);
    expect(html).toContain("There is no fixed label set here.");
  });

  it("hydrates from the persisted reasoning instead of calling Groq again", async () => {
    state.solve = {
      guessed_category: "RAG",
      revealed_category: "RAG",
      tool_class: "specialized",
      correct: true,
      why_it_fits: "The contracts are the source of truth they need to cite.",
      why_not_alternatives: [
        { category: "Classification", reason: "No fixed label set." },
        { category: "Summarization", reason: "They need retrieval, not compression." },
      ],
    };

    const html = await render();

    expect(runRevealStep).not.toHaveBeenCalled();
    expect(html).toContain("You had it.");
    expect(html).toContain("The contracts are the source of truth they need to cite.");
    expect(html).toContain("No fixed label set.");
    expect(html).toContain("They need retrieval, not compression.");
    // The persisted verdict is what renders — nothing from a fresh model call.
    expect(html).not.toContain(FRESH_REVEAL.whyItFits);
  });

  it("selects the persisted reasoning columns", async () => {
    state.solve = {
      guessed_category: "RAG",
      revealed_category: "RAG",
      tool_class: "specialized",
      correct: true,
      why_it_fits: "Cited answers.",
      why_not_alternatives: [{ category: "Classification", reason: "No labels." }],
    };

    await render();

    expect(state.selected.join(" ")).toContain("why_it_fits");
    expect(state.selected.join(" ")).toContain("why_not_alternatives");
  });

  it("still shows the verdict without re-running the model when a solve was revealed before the reasoning was stored", async () => {
    state.solve = {
      guessed_category: "Classification",
      revealed_category: "RAG",
      tool_class: "specialized",
      correct: false,
      why_it_fits: null,
      why_not_alternatives: null,
    };

    const html = await render();

    expect(runRevealStep).not.toHaveBeenCalled();
    expect(html).toContain("Not quite.");
    expect(html).toContain("You worked through this one already");
    expect(html).not.toContain("Why not the alternatives");
  });

  it("ignores malformed jsonb rather than rendering it", async () => {
    state.solve = {
      guessed_category: "Classification",
      revealed_category: "RAG",
      tool_class: "specialized",
      correct: false,
      why_it_fits: "Cited answers.",
      why_not_alternatives: { category: "Classification" },
    };

    const html = await render();

    expect(runRevealStep).not.toHaveBeenCalled();
    expect(html).toContain("You worked through this one already");
    expect(html).not.toContain("Why not the alternatives");
  });

  it("redirects to the guess screen when no guess is recorded", async () => {
    state.solve = { guessed_category: null };

    await expect(render()).rejects.toThrow("REDIRECT:/solve/s1/guess");
    expect(runRevealStep).not.toHaveBeenCalled();
  });
});
