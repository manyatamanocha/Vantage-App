"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Workflow order, not the hub's tile order: Review is where the day starts
// (it's the hub's hero), Analytics is where it ends.
const ADMIN_SECTIONS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/quiz-review", label: "Review" },
  { href: "/admin/questions", label: "Questions" },
  { href: "/admin/daily-content", label: "Daily content" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/analytics", label: "Analytics" },
] as const;

// Same rule as NavLinks: the section root ("/admin") only matches exactly,
// everything else also lights up for anything nested under it.
function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(href + "/");
}

/**
 * Second-level nav under SiteNav, for admin pages only. Before this, moving
 * from Analytics to Users meant Back → click a tile; the sections had no way
 * to reach each other.
 *
 * Deliberately reuses NavLinks' pill styling rather than inventing a second
 * "which section am I in" idiom — the row reads as a nested version of the
 * main nav, which is what it is. The "Admin" chip on the left is what lets
 * the pages themselves drop their repeated .datechip topline.
 */
export function AdminSubnav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Admin sections" className="border-b border-border">
      <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center gap-x-[18px] gap-y-2 px-5 py-[11px] text-[13px] sm:px-8">
        <span className="datechip">Admin</span>
        {ADMIN_SECTIONS.map((section) => {
          const active = isActive(pathname, section.href);
          return (
            <Link
              key={section.href}
              href={section.href}
              aria-current={active ? "page" : undefined}
              className={
                active
                  ? "rounded-full bg-accent2 px-3.5 py-1.5 font-semibold text-accent2-foreground"
                  : "text-foreground opacity-70 hover:opacity-100"
              }
            >
              {section.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
