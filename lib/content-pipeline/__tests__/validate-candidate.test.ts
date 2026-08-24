import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/engine/reveal", () => ({
  recommendCategory: vi.fn(),
}));

import { validateCandidate } from "../validate-candidate";
import { recommendCategory, type RevealResult } from "@/lib/engine/reveal";
import type { PracticeCaseCandidate } from "../generate-cases";

const CANDIDATE: PracticeCaseCandidate = {
  rawInput: "A retailer wants fake reviews flagged before they go live.",
  industry: "Retail",
  intendedCategory: "Classification",
  difficulty: "easy",
};

const REVEAL_MATCH: RevealResult = {
  match: true,
  revealedCategory: "Classification",
  whyItFits: "Each review is sorted into genuine or fake.",
  whyNotAlternatives: [{ category: "RAG", reason: "There's nothing to retrieve here." }],
  toolClass: "specialized" as const,
};

describe("validateCandidate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts a candidate whose live-recomputed category matches its intended one", async () => {
    vi.mocked(recommendCategory).mockResolvedValueOnce(REVEAL_MATCH);
    const result = await validateCandidate(CANDIDATE);
    expect(result).toEqual({ valid: true });
  });

  it("calls recommendCategory with the candidate text as both goal and problemType", async () => {
    vi.mocked(recommendCategory).mockResolvedValueOnce(REVEAL_MATCH);
    await validateCandidate(CANDIDATE);
    expect(recommendCategory).toHaveBeenCalledWith({
      goal: CANDIDATE.rawInput,
      problemType: CANDIDATE.rawInput,
      guessedCategory: CANDIDATE.intendedCategory,
    });
  });

  it("rejects a candidate whose live-recomputed category disagrees with its intended one", async () => {
    vi.mocked(recommendCategory).mockResolvedValueOnce({ ...REVEAL_MATCH, revealedCategory: "RAG", match: false });
    const result = await validateCandidate(CANDIDATE);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toMatch(/disagrees|mismatch/i);
  });

  it("rejects a candidate whose raw_input names a specific product", async () => {
    const withProduct: PracticeCaseCandidate = {
      ...CANDIDATE,
      rawInput: "A retailer wants ChatGPT to flag fake reviews.",
    };
    const result = await validateCandidate(withProduct);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toMatch(/named a specific product/i);
    expect(recommendCategory).not.toHaveBeenCalled();
  });

  it("rejects, rather than throws, when recommendCategory itself fails", async () => {
    vi.mocked(recommendCategory).mockRejectedValueOnce(new Error("groq is down"));
    const result = await validateCandidate(CANDIDATE);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toMatch(/groq is down/);
  });
});
