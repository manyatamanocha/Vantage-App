import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * The destination the magic-link email lands on. `code` is the PKCE code
 * Supabase appends to `emailRedirectTo`; exchanging it here (a Route Handler,
 * not a Server Action) is required because this must run on a plain GET
 * request the user's email client follows, and it's the one place outside
 * middleware.ts that's actually allowed to write cookies before any page
 * render happens.
 */
function safeNext(raw: string | null): string {
  const fallback = "/";
  if (!raw) return fallback;
  try {
    const resolved = new URL(raw, "http://localhost");
    const rebuilt = resolved.pathname + resolved.search + resolved.hash;
    if (!rebuilt.startsWith("/") || rebuilt.startsWith("//")) return fallback;
    return rebuilt;
  } catch {
    return fallback;
  }
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (list) => list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
        },
      }
    );
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/login?error=link_expired`);
}
