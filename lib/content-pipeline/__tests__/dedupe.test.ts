import { describe, it, expect } from "vitest";
import { jaccardSimilarity, dedupeCandidates, DUPLICATE_THRESHOLD } from "../dedupe";

describe("jaccardSimilarity", () => {
  it("returns 1 for identical text", () => {
    expect(jaccardSimilarity("flag fake reviews", "flag fake reviews")).toBe(1);
  });

  it("returns 0 for completely different text", () => {
    expect(jaccardSimilarity("flag fake reviews", "forecast quarterly demand")).toBe(0);
  });

  it("is case-insensitive and ignores punctuation", () => {
    expect(jaccardSimilarity("Flag Fake Reviews!", "flag fake reviews")).toBe(1);
  });

  it("scores high for near-duplicate phrasing", () => {
    const a = "An online marketplace wants every incoming product review sorted into genuine or fake before it goes live.";
    const b = "An online marketplace wants incoming product reviews sorted into genuine or fake before they go live.";
    expect(jaccardSimilarity(a, b)).toBeGreaterThanOrEqual(DUPLICATE_THRESHOLD);
  });

  it("scores low for genuinely different scenarios in the same domain", () => {
    const a = "An online marketplace wants every incoming product review sorted into genuine or fake before it goes live.";
    const b = "A logistics firm receives supplier invoices as scanned PDFs and wants the line items pulled out.";
    expect(jaccardSimilarity(a, b)).toBeLessThan(DUPLICATE_THRESHOLD);
  });
});

describe("dedupeCandidates", () => {
  it("keeps a candidate that doesn't resemble anything existing", () => {
    const candidates = [{ rawInput: "Forecast which customers will cancel next month." }];
    const result = dedupeCandidates(candidates, ["Flag fake product reviews before they go live."]);
    expect(result).toEqual(candidates);
  });

  it("drops a candidate that duplicates an existing row", () => {
    const candidates = [{ rawInput: "Flag fake product reviews before they go live." }];
    const result = dedupeCandidates(candidates, ["Flag fake product reviews before they go live on the site."]);
    expect(result).toEqual([]);
  });

  it("drops the second of two near-duplicate candidates within the same batch", () => {
    const candidates = [
      { rawInput: "Forecast which customers will cancel their subscription next month." },
      { rawInput: "Forecast which customers will cancel their subscription in the next month." },
    ];
    const result = dedupeCandidates(candidates, []);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(candidates[0]);
  });

  it("keeps candidates and existing rows unmodified — no mutation", () => {
    const candidates = [{ rawInput: "Forecast which customers will cancel next month.", extra: "kept" }];
    const existing = ["Flag fake product reviews before they go live."];
    dedupeCandidates(candidates, existing);
    expect(candidates[0]).toEqual({ rawInput: "Forecast which customers will cancel next month.", extra: "kept" });
    expect(existing).toEqual(["Flag fake product reviews before they go live."]);
  });
});
