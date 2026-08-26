import Link from "next/link";
import { requireAdmin } from "@/lib/auth/admin";

const SECTIONS = [
  { href: "/admin/quiz-review", label: "Content review", desc: "Approve or reject newly generated questions before they reach users." },
  { href: "/admin/questions", label: "Questions", desc: "Add, edit, or delete Tech & AI quiz and scenario quiz questions directly." },
  { href: "/admin/daily-content", label: "Daily content", desc: "See how much new content was generated today, per quiz type and tier." },
  { href: "/admin/users", label: "Users", desc: "Signups, activity, and practice progress — no auth data." },
  { href: "/admin/analytics", label: "Analytics", desc: "Usage funnel, daily event counts, recent activity." },
] as const;

export default async function AdminHubPage() {
  await requireAdmin();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 py-8 sm:px-8 sm:py-12">
      <header>
        <div className="topline"><span className="datechip">Admin</span></div>
        <h1 className="display">Admin dashboard</h1>
        <p className="lede">Visible only to the administrator account.</p>
      </header>

      <section className="grid-2">
        {SECTIONS.map((section) => (
          <Link key={section.href} href={section.href} className="panel-link outline group">
            <h2>{section.label}</h2>
            <p className="panel-lede">{section.desc}</p>
          </Link>
        ))}
      </section>
    </main>
  );
}
