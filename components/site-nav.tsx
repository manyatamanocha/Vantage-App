import Link from "next/link";
import { getVerifiedUser } from "@/lib/supabase/server";
import { signOutAction } from "@/app/(auth)/actions";
import { NavLinks } from "./nav-links";
import { ThemeToggle } from "./theme-toggle";
import { BackButton } from "./back-button";

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
        <NavLinks />
        <div className="ml-auto flex flex-col items-end gap-1.5">
          <form action={signOutAction}>
            <button
              type="submit"
              className="flex items-center gap-1.5 border-0 bg-transparent p-0 font-sans text-[13px] text-foreground opacity-60 hover:opacity-100"
            >
              Sign out
            </button>
          </form>
          <ThemeToggle />
        </div>
      </nav>
      <div className="mx-auto w-full max-w-3xl px-[22px] pb-[13px]">
        <BackButton />
      </div>
    </header>
  );
}
