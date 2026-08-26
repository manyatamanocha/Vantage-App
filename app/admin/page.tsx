import Link from "next/link";
import { ListChecks, CalendarClock, Users, LineChart } from "lucide-react";
import { requireAdmin } from "@/lib/auth/admin";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const SECTIONS = [
  { href: "/admin/questions", label: "Questions", desc: "Add, edit, or delete questions directly.", icon: ListChecks },
  { href: "/admin/daily-content", label: "Daily content", desc: "Generated today, per quiz type and tier.", icon: CalendarClock },
  { href: "/admin/users", label: "Users", desc: "Signups, activity, practice progress.", icon: Users },
  { href: "/admin/analytics", label: "Analytics", desc: "Usage funnel, daily events.", icon: LineChart },
] as const;

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

export default async function AdminHubPage() {
  await requireAdmin();
  const admin = getSupabaseAdminClient();
  const { start, end } = todayRange();

  // Same 7-day "active" definition as /admin/users, so this ring matches
  // that page's numbers rather than inventing a second definition of active.
  const ACTIVE_WINDOW_DAYS = 7;
  const activeCutoffIso = new Date(Date.now() - ACTIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const [
    pendingQuestions,
    pendingCases,
    questionsTotal,
    casesTotal,
    dailyGeneral,
    dailyScenario,
    usersPage,
    recentActivity,
  ] = await Promise.all([
    admin.from("daily_quiz_questions").select("id", { count: "exact", head: true }).eq("review_status", "pending"),
    admin.from("practice_cases").select("id", { count: "exact", head: true }).eq("review_status", "pending"),
    admin.from("daily_quiz_questions").select("id", { count: "exact", head: true }),
    admin.from("practice_cases").select("id", { count: "exact", head: true }),
    admin.from("general_quiz_questions").select("id", { count: "exact", head: true }).gte("created_at", start).lte("created_at", end),
    admin.from("scenario_quiz_questions").select("id", { count: "exact", head: true }).gte("created_at", start).lte("created_at", end),
    admin.auth.admin.listUsers({ perPage: 200 }),
    admin.from("analytics_events").select("user_id").eq("event_name", "meaningful_activity_completed").gte("created_at", activeCutoffIso),
  ]);

  const pendingReviewCount = (pendingQuestions.count ?? 0) + (pendingCases.count ?? 0);
  const questionsCount = (questionsTotal.count ?? 0) + (casesTotal.count ?? 0);
  const dailyContentToday = (dailyGeneral.count ?? 0) + (dailyScenario.count ?? 0);
  const usersCount = usersPage.data?.users.length ?? 0;
  const activeUserIds = new Set((recentActivity.data ?? []).map((r) => r.user_id as string | null).filter(Boolean));
  const activePercent = usersCount > 0 ? Math.round((activeUserIds.size / usersCount) * 100) : 0;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 py-8 sm:px-8 sm:py-12">
      <header>
        <div className="topline"><span className="datechip">Admin</span></div>
        <h1 className="display">Admin dashboard</h1>
        <p className="lede">Visible only to the administrator account.</p>
      </header>

      <Link href="/admin/quiz-review" className="admin-hero group">
        <span className="admin-hero-tag">{pendingReviewCount > 0 ? "Needs attention" : "All caught up"}</span>
        <div className="admin-hero-big">
          {pendingReviewCount} {pendingReviewCount === 1 ? "question" : "questions"}
        </div>
        <span className="admin-hero-sub">
          {pendingReviewCount > 0 ? "waiting on content review →" : "nothing pending review →"}
        </span>
      </Link>

      <section className="admin-stat-grid">
        {SECTIONS.map((section) => {
          const Icon = section.icon;

          // Users gets a ring-progress treatment (share of users active in
          // the last 7 days, same definition as /admin/users) instead of a
          // plain number — picked from 4 mocked-up tile options.
          if (section.href === "/admin/users") {
            return (
              <Link key={section.href} href={section.href} className="admin-stat-tile admin-stat-tile-ring group">
                <div
                  className="admin-stat-ring"
                  style={{ background: `conic-gradient(var(--primary) 0% ${activePercent}%, var(--border) ${activePercent}% 100%)` }}
                >
                  <span>{activePercent}%</span>
                </div>
                <div>
                  <div className="admin-stat-label" style={{ marginBottom: 2 }}>
                    {usersCount.toLocaleString()} {section.label}
                  </div>
                  <p className="admin-stat-desc">{activePercent}% active this week</p>
                </div>
              </Link>
            );
          }

          const stat =
            section.href === "/admin/questions"
              ? questionsCount.toLocaleString()
              : section.href === "/admin/daily-content"
                ? dailyContentToday.toLocaleString()
                : null;
          return (
            <Link key={section.href} href={section.href} className="admin-stat-tile group">
              <Icon className="icon size-5" aria-hidden="true" />
              {stat !== null ? <div className="admin-stat-num">{stat}</div> : null}
              <div className="admin-stat-label">{section.label}</div>
              <p className="admin-stat-desc">{section.desc}</p>
            </Link>
          );
        })}
      </section>
    </main>
  );
}
