import { cache } from "react";
import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export async function getSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => {
          // Next.js only allows cookie writes from Server Actions and Route
          // Handlers — a write during a Server Component render throws. That
          // write happens here whenever @supabase/ssr silently refreshes an
          // aged access token mid-render, which is not an error condition the
          // page can do anything about. Swallowing it is the documented
          // Supabase/Next.js pattern: `middleware.ts` at the repo root calls
          // `auth.getUser()` on every matched request, so the refreshed session
          // is persisted there (where cookie writes ARE allowed) before the
          // render ever runs.
          try {
            list.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Intentionally ignored — see above.
          }
        },
      },
    }
  );
}

/**
 * `auth.getUser()` re-validates the session against Supabase's Auth server on
 * every call — a real network round trip, not a local JWT check. Before this,
 * every page called it once (often twice: once in `SiteNav`, again in the
 * page itself) and every server action it invoked called it again, so a
 * single navigation could pay for three or four of these round trips.
 *
 * `cache()` (React's per-request memoization, not a persistent cache) makes
 * every one of those calls within a single request collapse into the one
 * underlying request that actually reaches Supabase. It does not replace
 * `middleware.ts`'s own `auth.getUser()` call — that one refreshes an aged
 * token and must keep running ahead of the render, in the one place cookie
 * writes are allowed outside a Server Action.
 */
export const getVerifiedUser = cache(async (): Promise<{
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>;
  user: User | null;
}> => {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
});
