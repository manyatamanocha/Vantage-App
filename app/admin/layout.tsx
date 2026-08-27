import type { ReactNode } from "react";
import { requireAdmin } from "@/lib/auth/admin";
import { AdminSubnav } from "@/components/admin-subnav";

/**
 * Wraps every /admin/* page in the section subnav. Note it does NOT reach
 * /demo/analytics, which renders the same AnalyticsDashboard from outside
 * this segment — that public link stays free of admin chrome, which is the
 * whole point of it existing.
 *
 * No <main> here: each page renders its own, and nesting them is invalid.
 *
 * requireAdmin() is defence in depth. Every page still calls it itself, since
 * a layout is not a security boundary in Next — it doesn't re-run on every
 * client-side navigation between sibling routes.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdmin();

  return (
    <>
      <AdminSubnav />
      {children}
    </>
  );
}
