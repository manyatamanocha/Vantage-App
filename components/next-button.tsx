"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight } from "lucide-react";

// Mirrors back-button.tsx's SECTIONS — Next always steps to the next
// top-level section, not browser history. Keep this list in sync with
// back-button.tsx if the section order ever changes.
const SECTIONS = ["/", "/solve", "/practice", "/progress", "/settings"] as const;

function currentSectionIndex(pathname: string): number {
  if (pathname === "/") return 0;
  for (let i = SECTIONS.length - 1; i >= 1; i--) {
    if (pathname === SECTIONS[i] || pathname.startsWith(SECTIONS[i] + "/")) return i;
  }
  return 0;
}

/**
 * Forward counterpart to BackButton — steps to the next top-level section.
 * Hidden on Settings, the last section (nowhere to go next).
 */
export function NextButton() {
  const pathname = usePathname();
  const index = currentSectionIndex(pathname);

  if (index === SECTIONS.length - 1) return null;

  return (
    <Link
      href={SECTIONS[index + 1]}
      className="flex cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 text-[13.5px] font-semibold text-primary transition-opacity hover:opacity-70 active:opacity-50"
    >
      Next <ArrowRight size={15} aria-hidden="true" />
    </Link>
  );
}
