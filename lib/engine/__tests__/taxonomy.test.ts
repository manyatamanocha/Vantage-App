import { describe, it, expect } from "vitest";
import { CATEGORY_TAXONOMY } from "../taxonomy";

describe("CATEGORY_TAXONOMY", () => {
  it("has no duplicate entries", () => {
    expect(new Set(CATEGORY_TAXONOMY).size).toBe(CATEGORY_TAXONOMY.length);
  });
  it("includes the categories referenced in the product spec", () => {
    expect(CATEGORY_TAXONOMY).toContain("Classification");
    expect(CATEGORY_TAXONOMY).toContain("RAG");
    expect(CATEGORY_TAXONOMY).toContain("Prediction");
  });
});
