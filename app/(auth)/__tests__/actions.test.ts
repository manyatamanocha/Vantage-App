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
      signInWithPassword: async () => ({ data: {}, error: state.signInError }),
      signUp: async () => ({
        data: { session: state.signUpSession },
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
});

describe("signInWithEmail", () => {
  it("surfaces Supabase's own message so the form can render it", async () => {
    state.signInError = { message: "Invalid login credentials" };
    const result = await signInWithEmail(credentials());
    expect(result.error).toBe("Invalid login credentials");
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
