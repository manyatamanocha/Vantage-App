import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Every authenticated page in this app reads its session through
 * `getSupabaseServerClient()` during a Server Component render, and Next.js
 * forbids cookie writes there. That makes a *render* the wrong place for
 * @supabase/ssr to persist a refreshed access token — so this middleware is the
 * place that does it: it runs before the render, calls `auth.getUser()` (which
 * triggers a refresh when the token has aged out), and returns a response
 * carrying the updated cookies.
 *
 * It is also the single place unauthenticated access is turned away. Before
 * this existed, each protected route implemented its own check independently
 * (redirect, throw, or nothing at all), so the same "not logged in" situation
 * produced a different experience per route. The per-action `getUser()` checks
 * in the server actions stay as defence in depth — a server action is a public
 * endpoint and must not rely on the edge alone.
 */
const PROTECTED_PREFIXES = ["/solve", "/practice", "/progress", "/settings"];

function isProtected(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export async function middleware(request: NextRequest) {
  // The response must be created up front so the Supabase client can write
  // refreshed cookies onto BOTH the request (so anything later in this same
  // pass reads the new value) and the response (so the browser stores it).
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Do not remove: this call is what actually refreshes an expiring session.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && isProtected(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    // Send the user back where they were headed once they're signed in.
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except Next's own static output, image optimizer, the
     * favicon, static asset requests, and /login|/signup — none of which
     * carry a session worth refreshing, and all of which would otherwise pay
     * for a network round trip to Supabase on every single request. /login
     * and /signup are excluded because a visitor there either has no session
     * yet (nothing to refresh) or is about to establish one via the auth
     * actions in app/(auth)/actions.ts, which get their own Supabase client —
     * this middleware's refresh is redundant work on the one path where
     * request latency is most visible.
     */
    "/((?!_next/static|_next/image|favicon.ico|login|signup|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf)$).*)",
  ],
};
