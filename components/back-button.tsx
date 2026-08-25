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
 */
export function BackButton() {
  const pathname = usePathname();
  const index = currentSectionIndex(pathname);

  if (index === 0) return null;

  return (
    <Link
      href={SECTIONS[index - 1]}
      className="flex cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 text-[13.5px] font-semibold text-primary transition-opacity hover:opacity-70 active:opacity-50"
    >
      <ArrowLeft size={15} aria-hidden="true" /> Back
    </Link>
  );
}
