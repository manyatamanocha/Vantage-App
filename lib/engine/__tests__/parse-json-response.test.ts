import { describe, it, expect } from "vitest";
import { parseJsonResponse } from "../parse-json-response";

type Shape = { goal: string };

function isShape(parsed: unknown): parsed is Shape {
  return (
    typeof parsed === "object" &&
    parsed !== null &&
    typeof (parsed as Shape).goal === "string"
  );
}

describe("parseJsonResponse", () => {
  it("returns the parsed value when it satisfies the validator", () => {
    expect(parseJsonResponse('{"goal":"Reduce churn"}', isShape)).toEqual({
      goal: "Reduce churn",
    });
  });

  it("throws a parse error carrying the original text and cause on invalid JSON", () => {
    let thrown: unknown;
    try {
      parseJsonResponse("not json", isShape, "structure");
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toMatch(/parse/i);
    expect((thrown as Error).message).toContain("not json");
    expect((thrown as Error).cause).toBeInstanceOf(Error);
  });

  it("throws a parse error when the validator rejects the shape", () => {
    expect(() => parseJsonResponse('{"goal":42}', isShape)).toThrow(
      /parse .* unexpected shape/i
    );
  });

  it("reports an empty response rather than an empty message", () => {
    expect(() => parseJsonResponse("", isShape)).toThrow(/<empty>/);
  });
});
