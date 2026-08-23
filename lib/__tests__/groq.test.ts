import { describe, it, expect, vi } from "vitest";

describe("getGroqClient", () => {
  it("throws when called in a browser-like environment", async () => {
    vi.stubGlobal("window", {});
    const { getGroqClient } = await import("../groq");
    expect(() => getGroqClient()).toThrow(/server-side/);
    vi.unstubAllGlobals();
  });
});
