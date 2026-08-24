import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const state = vi.hoisted(() => ({
  user: null as { id: string } | null,
  getUserCalls: 0,
}));

// The middleware's job is (a) call getUser() so an aged session is refreshed
// where cookie writes are legal, and (b) turn unauthenticated visitors away
// from protected routes. Only the Supabase client is faked; the routing
// decisions under test are the middleware's own.
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getUser: async () => {
        state.getUserCalls += 1;
        return { data: { user: state.user }, error: null };
      },
    },
  }),
}));

import { middleware, config } from "../middleware";

function request(path: string) {
  return new NextRequest(new URL(path, "https://vantage.test"));
}

beforeEach(() => {
  state.user = { id: "u1" };
  state.getUserCalls = 0;
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "anon";
});

describe("middleware session refresh", () => {
  it("calls getUser on every matched request, which is what refreshes the session", async () => {
    await middleware(request("/login"));
    expect(state.getUserCalls).toBe(1);
  });
});

describe("middleware route protection", () => {
  const protectedPaths = [
    "/solve",
    "/solve/new",
    "/solve/abc-123/reveal",
    "/practice",
    "/practice/today",
    "/practice/history",
    "/progress",
    "/settings",
  ];

  it.each(protectedPaths)("sends an unauthenticated visitor from %s to /login", async (path) => {
    state.user = null;
    const response = await middleware(request(path));
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe(path);
  });

  it.each(protectedPaths)("lets an authenticated visitor through to %s", async (path) => {
    const response = await middleware(request(path));
    expect(response.headers.get("location")).toBeNull();
  });

  const publicPaths = ["/", "/login", "/signup"];

  it.each(publicPaths)("never redirects an unauthenticated visitor away from %s", async (path) => {
    state.user = null;
    const response = await middleware(request(path));
    expect(response.headers.get("location")).toBeNull();
  });

  it("does not treat a route that merely starts with the same letters as protected", async () => {
    // `/settings-export` must not match the `/settings` prefix.
    state.user = null;
    const response = await middleware(request("/settings-export"));
    expect(response.headers.get("location")).toBeNull();
  });

  it("preserves the original query string in the next param", async () => {
    state.user = null;
    const response = await middleware(request("/practice/history?page=2"));
    const location = new URL(response.headers.get("location")!);
    expect(location.searchParams.get("next")).toBe("/practice/history?page=2");
  });
});

describe("middleware matcher", () => {
  const matcher = new RegExp(`^${config.matcher[0]}$`);

  it.each(["/", "/progress", "/solve/abc/reveal"])("runs on %s", (path) => {
    expect(matcher.test(path)).toBe(true);
  });

  it.each([
    "/_next/static/chunks/main.js",
    "/_next/image",
    "/favicon.ico",
    "/next.svg",
    "/fonts/inter.woff2",
    // A visitor here either has no session yet or is establishing one via
    // app/(auth)/actions.ts's own Supabase client — the middleware's refresh
    // is redundant work on the one path where latency is most visible.
    "/login",
    "/signup",
  ])("skips %s, which carries no session worth refreshing", (path) => {
    expect(matcher.test(path)).toBe(false);
  });
});
