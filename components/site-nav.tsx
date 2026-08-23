import Link from "next/link";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { signOutAction } from "@/app/(auth)/actions";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/solve/new", label: "Solve" },
  { href: "/practice/today", label: "Practice" },
  { href: "/practice/history", label: "History" },
  { href: "/progress", label: "Progress" },
  { href: "/settings", label: "Settings" },
] as const;

/**
 * The app's only shell. Every screen in this build is otherwise reachable
 * exclusively by typing its URL, so this is what turns twelve routes into an
 * app.
 *
 * It renders nothing for a signed-out visitor: the only pages they can reach
 * are /login and /signup (the middleware sends them there from anywhere else),
 * and those two link to each other. A nav full of links that all bounce back to
 * /login would be worse than no nav.
 */
export async function SiteNav() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  return (
    <header className="border-b border-black/10 dark:border-white/15">
      <nav
        aria-label="Main"
        className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-4 px-6 py-3 text-sm"
      >
        <Link href="/" className="font-semibold">
          Vantage
        </Link>
        {NAV_LINKS.map((link) => (
          <Link key={link.href} href={link.href} className="opacity-80 hover:opacity-100">
            {link.label}
          </Link>
        ))}
        <form action={signOutAction} className="ml-auto">
          <button type="submit" className="opacity-80 hover:opacity-100">
            Sign out
          </button>
        </form>
      </nav>
    </header>
  );
}
