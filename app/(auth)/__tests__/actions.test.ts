import { describe, it, expect, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  signInError: null as { message: string } | null,
  signUpSession: {} as unknown,
  signUpError: null as { message: string } | null,
  redirectedTo: [] as string[],
  signedOut: 0,
}));

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: async () => ({
    auth: {
      signInWithPassword: async () => ({
        data: { user: state.signInError ? undefined : { id: "u1" } },
        error: state.signInError,
      }),
      signUp: async () => ({
        data: {
          user: state.signUpError ? undefined : { id: "u1" },
          session: state.signUpSession,
        },
        error: state.signUpError,
      }),
      signOut: async () => {
        state.signedOut += 1;
        return { error: null };
      },
    },
  }),
}));

// `redirect()` throws a special error in Next so control never returns to the
// caller. Recording the target and throwing the same way keeps the actions'
// control flow honest — a test where redirect silently returned would let a
// "redirect happened" assertion pass on code that then kept running.
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    state.redirectedTo.push(url);
    throw new Error("NEXT_REDIRECT");
  },
}));

// Unmocked, this action calls the REAL track(), which calls the REAL
// getSupabaseAdminClient() and inserts into the live analytics_events table —
// this file's mocked auth client has no `user` field, so every insert landed
// with a null user_id. That is how this suite spent a day writing null rows
// into production every time it ran (see analytics-events-null-user-id memory).
vi.mock("@/lib/analytics/track", () => ({ track: vi.fn() }));

import {
  signUpWithEmail,
  signInWithEmail,
  loginAction,
  signupAction,
  signOutAction,
} from "../actions";

function credentials(extra: Record<string, string> = {}) {
  const fd = new FormData();
  fd.set("email", "consultant@firm.example");
  fd.set("password", "correcthorsebatterystaple");
  for (const [key, value] of Object.entries(extra)) fd.set(key, value);
  return fd;
}

beforeEach(() => {
  state.signInError = null;
  state.signUpSession = { access_token: "t" };
  state.signUpError = null;
  state.redirectedTo = [];
  state.signedOut = 0;
});

describe("signUpWithEmail", () => {
  it("rejects missing email", async () => {
    const fd = new FormData();
    fd.set("password", "correcthorsebatterystaple");
    const result = await signUpWithEmail(fd);
    expect(result.error).toMatch(/email/i);
  });

  it("reports that confirmation is needed when Supabase issues no session", async () => {
    state.signUpSession = null;
    const result = await signUpWithEmail(credentials());
    expect(result).toEqual({ needsConfirmation: true });
  });

  it("records signup with the new user's id, not null", async () => {
    const { track } = await import("@/lib/analytics/track");
    await signUpWithEmail(credentials());
    expect(track).toHaveBeenCalledWith("signup", "u1");
  });
});

describe("signInWithEmail", () => {
  it("surfaces Supabase's own message so the form can render it", async () => {
    state.signInError = { message: "Invalid login credentials" };
    const result = await signInWithEmail(credentials());
    expect(result.error).toBe("Invalid login credentials");
  });

  // Regression test for a real incident: this file didn't mock track() until
  // now, so every test run called the REAL track(), which inserted into the
  // LIVE analytics_events table with user_id null (this mock's data has no
  // `user` field). Asserting the id reaches track() is what would have
  // caught it — a mock that merely exists doesn't prove the argument is right.
  it("records login with the signed-in user's id, not null", async () => {
    const { track } = await import("@/lib/analytics/track");
    await signInWithEmail(credentials());
    expect(track).toHaveBeenCalledWith("login", "u1");
  });
});

describe("loginAction", () => {
  it("redirects home on success", async () => {
    await expect(loginAction(null, credentials())).rejects.toThrow("NEXT_REDIRECT");
    expect(state.redirectedTo).toEqual(["/"]);
  });

  it("redirects to the route the middleware turned the user away from", async () => {
    await expect(
      loginAction(null, credentials({ next: "/practice/today" }))
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(state.redirectedTo).toEqual(["/practice/today"]);
  });

  it.each(["https://evil.example/steal", "//evil.example/steal", "javascript:alert(1)"])(
    "ignores %s rather than turning the login form into an open redirect",
    async (hostile) => {
      // `next` reaches this action from a URL anyone can craft and send.
      await expect(
        loginAction(null, credentials({ next: hostile }))
      ).rejects.toThrow("NEXT_REDIRECT");
      expect(state.redirectedTo).toEqual(["/"]);
    }
  );

  // Browsers strip a leading backslash to a slash, and strip ASCII
  // tab/CR/LF from a URL entirely, before resolving it. Both behaviours let
  // a value that merely *starts* with a single "/" turn into a
  // protocol-relative "//evil.example" once the browser resolves it, which
  // a naive `startsWith("/") && !startsWith("//")` check would miss.
  it.each([
    "/\\evil.example/x",
    "/\t/evil.example",
    "/\r/evil.example",
    "/\n/evil.example",
  ])(
    "ignores %j, a browser-normalization bypass for the leading-slash check",
    async (hostile) => {
      await expect(
        loginAction(null, credentials({ next: hostile }))
      ).rejects.toThrow("NEXT_REDIRECT");
      expect(state.redirectedTo).toEqual(["/"]);
    }
  );

  it("returns the error and does not redirect when sign-in fails", async () => {
    state.signInError = { message: "Invalid login credentials" };
    const result = await loginAction(null, credentials());
    expect(result.error).toBe("Invalid login credentials");
    expect(state.redirectedTo).toEqual([]);
  });
});

describe("signupAction", () => {
  it("redirects on success", async () => {
    await expect(signupAction(null, credentials())).rejects.toThrow("NEXT_REDIRECT");
    expect(state.redirectedTo).toEqual(["/"]);
  });

  it("stays on the page when the account still needs email confirmation", async () => {
    state.signUpSession = null;
    const result = await signupAction(null, credentials());
    expect(result.needsConfirmation).toBe(true);
    expect(state.redirectedTo).toEqual([]);
  });
});

describe("signOutAction", () => {
  it("signs out and sends the user to the login screen", async () => {
    await expect(signOutAction()).rejects.toThrow("NEXT_REDIRECT");
    expect(state.signedOut).toBe(1);
    expect(state.redirectedTo).toEqual(["/login"]);
  });
});
