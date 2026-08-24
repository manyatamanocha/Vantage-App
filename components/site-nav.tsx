import Link from "next/link";
import { getVerifiedUser } from "@/lib/supabase/server";
import { signOutAction } from "@/app/(auth)/actions";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/solve/new", label: "Solve" },
  { href: "/practice/today", label: "Practice" },
  { href: "/practice/jargon", label: "Daily quiz" },
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
  const { user } = await getVerifiedUser();

  if (!user) return null;

  return (
    <header className="border-b border-border">
      <nav
        aria-label="Main"
        className="mx-auto flex w-full max-w-3xl flex-wrap items-center gap-[18px] px-[22px] py-[13px] text-[13.5px]"
      >
        <Link href="/" className="font-heading font-bold tracking-tight text-foreground">
          Vantage
        </Link>
        {NAV_LINKS.map((link) => (
          <Link key={link.href} href={link.href} className="text-foreground opacity-70 hover:opacity-100">
            {link.label}
          </Link>
        ))}
        <form action={signOutAction} className="ml-auto">
          <button
            type="submit"
            className="flex items-center gap-1.5 border-0 bg-transparent p-0 font-sans text-[13px] text-foreground opacity-60 hover:opacity-100"
          >
            Sign out
          </button>
        </form>
      </nav>
    </header>
  );
}
