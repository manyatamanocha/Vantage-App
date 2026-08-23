import { describe, it, expect } from "vitest";
import { checkFinishReason } from "../check-finish-reason";

describe("checkFinishReason", () => {
  it("throws a truncation-specific error when finish_reason is 'length'", () => {
    expect(() => checkFinishReason("length", "structure")).toThrow(
      /truncated/i
    );
    expect(() => checkFinishReason("length", "structure")).toThrow(
      /max_tokens/i
    );
  });

  it("does not throw for 'stop'", () => {
    expect(() => checkFinishReason("stop", "structure")).not.toThrow();
  });

  it("does not throw for null or undefined", () => {
    expect(() => checkFinishReason(null, "structure")).not.toThrow();
    expect(() => checkFinishReason(undefined, "structure")).not.toThrow();
  });
});
