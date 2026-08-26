"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";

// Fixed section order (mirrors NavLinks) — Back always steps to the
// previous top-level section, not browser history. E.g. any /solve/* page
// goes back to Home, any /practice/* page goes back to Solve, and so on.
const SECTIONS = ["/", "/solve", "/practice", "/progress", "/settings"] as const;

function currentSectionIndex(pathname: string): number {
  if (pathname === "/") return 0;
  for (let i = SECTIONS.length - 1; i >= 1; i--) {
    if (pathname === SECTIONS[i] || pathname.startsWith(SECTIONS[i] + "/")) return i;
  }
  return 0;
}

/**
 * Mirrors the mockup's "← Back" link (below the main nav row on every screen
 * except Login/Signup — SiteNav itself already renders nothing there for a
 * signed-out visitor, so no special-casing is needed here) and Home, which
 * has nowhere to go back to.
 *
 * Admin isn't part of the fixed Home→Solve→Practice→Progress→Settings
 * section order (it's reached from Settings, not a top-level tab), so it
 * needs its own destination rather than falling through currentSectionIndex
 * and landing on "no back button at all": /admin/* subpages go back to the
 * /admin hub, and the hub itself goes back to /settings, where it's linked
 * from.
 */
export function BackButton() {
  const pathname = usePathname();

  if (pathname === "/admin") {
    return <BackLink href="/settings" />;
  }
  if (pathname.startsWith("/admin/")) {
    return <BackLink href="/admin" />;
  }

  const index = currentSectionIndex(pathname);
  if (index === 0) return null;

  return <BackLink href={SECTIONS[index - 1]} />;
}

function BackLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="flex cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 text-[13.5px] font-semibold text-primary transition-opacity hover:opacity-70 active:opacity-50"
    >
      <ArrowLeft size={15} aria-hidden="true" /> Back
    </Link>
  );
}
