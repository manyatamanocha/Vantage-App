"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

/**
 * Mirrors the mockup's "← Back" link (below the main nav row on every screen
 * except Login/Signup — SiteNav itself already renders nothing there for a
 * signed-out visitor, so no special-casing is needed here). Uses the
 * browser's own history rather than a custom stack, which is what "remembers
 * navigation history, steps back one screen at a time" means in practice.
 */
export function BackButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="flex items-center gap-1.5 border-0 bg-transparent p-0 text-[13.5px] font-semibold text-primary transition-opacity hover:opacity-70 active:opacity-50"
    >
      <ArrowLeft size={15} aria-hidden="true" /> Back
    </button>
  );
}
