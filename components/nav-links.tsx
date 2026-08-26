"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/solve/new", label: "Solve" },
  { href: "/practice", label: "Practice" },
  { href: "/progress", label: "Progress" },
  { href: "/settings", label: "Settings" },
] as const;

const ADMIN_LINK = { href: "/admin", label: "Admin" } as const;

// Home ("/") only matches the exact path — everything else matches the path
// itself or anything nested under it (e.g. "/solve" also lights up for
// "/solve/new" and "/solve/abc123/guess"), mirroring how a consultant would
// read "which section am I in."
function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function NavLinks({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const links = isAdmin ? [...NAV_LINKS, ADMIN_LINK] : NAV_LINKS;

  return (
    <>
      {links.map((link) => {
        const active = isActive(pathname, link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "rounded-full bg-accent2 px-3.5 py-1.5 font-semibold text-accent2-foreground"
                : "text-foreground opacity-70 hover:opacity-100"
            }
          >
            {link.label}
          </Link>
        );
      })}
    </>
  );
}
