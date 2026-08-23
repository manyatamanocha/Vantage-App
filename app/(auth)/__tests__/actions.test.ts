import { describe, it, expect } from "vitest";
import { signUpWithEmail } from "../actions";

describe("signUpWithEmail", () => {
  it("rejects missing email", async () => {
    const fd = new FormData();
    fd.set("password", "correcthorsebatterystaple");
    const result = await signUpWithEmail(fd);
    expect(result.error).toMatch(/email/i);
  });
});
