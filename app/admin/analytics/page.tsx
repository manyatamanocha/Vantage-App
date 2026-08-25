import { getVerifiedUser } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

type EventRow = {
  id: string;
  event_name: string;
  user_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

const FUNNEL_STEPS = ["signup", "login", "solve_started", "guess_locked", "solution_generated", "quiz_attempt"] as const;

function utcDayKey(iso: string): string {
  return iso.slice(0, 10);
}

export default async function AnalyticsPage() {
  const { user } = await getVerifiedUser();
  if (!user?.id) redirect("/login");

  const admin = getSupabaseAdminClient();
  // 1000 is well past what a class-project MVP will generate; a real launch
  // would page this or aggregate in SQL instead of in memory.
  const { data } = await admin
    .from("analytics_events")
    .select("id, event_name, user_id, metadata, created_at")
    .order("created_at", { ascending: false })
    .limit(1000);

  const events = (data ?? []) as EventRow[];

  const countsByEvent = new Map<string, number>();
  const usersByEvent = new Map<string, Set<string>>();
  for (const e of events) {
    countsByEvent.set(e.event_name, (countsByEvent.get(e.event_name) ?? 0) + 1);
    if (e.user_id) {
      if (!usersByEvent.has(e.event_name)) usersByEvent.set(e.event_name, new Set());
      usersByEvent.get(e.event_name)!.add(e.user_id);
    }
  }

  const totalUsers = new Set(events.filter((e) => e.user_id).map((e) => e.user_id)).size;

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - (6 - i));
    return d.toISOString().slice(0, 10);
  });
  const dailyCounts = last7Days.map((day) => ({
    day,
    count: events.filter((e) => utcDayKey(e.created_at) === day).length,
  }));
  const maxDaily = Math.max(1, ...dailyCounts.map((d) => d.count));

  const recent = events.slice(0, 25);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-5 py-8 sm:px-8 sm:py-12">
      <header>
        <div className="topline"><span className="datechip">Admin</span></div>
        <h1 className="display">Analytics</h1>
        <p className="lede">Real usage events, logged as they happen — no sample data.</p>
      </header>

      <section className="stack">
        <span className="card-label">Funnel — all-time event counts, distinct users in brackets</span>
        <div className="card">
          {events.length === 0 ? (
            <p className="card-text">No events recorded yet. Sign up, solve a problem, or take a quiz to generate the first ones.</p>
          ) : (
            FUNNEL_STEPS.map((step) => (
              <div className="history-row" key={step}>
                <div className="flex-1">
                  <strong>{step}</strong>
                </div>
                <span className="badge">
                  {countsByEvent.get(step) ?? 0} ({usersByEvent.get(step)?.size ?? 0} users)
                </span>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="stack">
        <span className="card-label">Last 7 days</span>
        <div className="card">
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 100 }}>
            {dailyCounts.map(({ day, count }) => (
              <div key={day} style={{ flex: 1, textAlign: "center" }}>
                <div
                  style={{
                    height: `${Math.max(4, (count / maxDaily) * 80)}px`,
                    background: "var(--primary)",
                    borderRadius: 4,
                    marginBottom: 6,
                  }}
                  title={`${count} events`}
                />
                <span className="text-sm text-muted-foreground">{day.slice(5)}</span>
                <div className="text-sm">{count}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="stack">
        <span className="card-label">Totals</span>
        <div className="card">
          <div className="history-row">
            <div className="flex-1"><strong>Distinct users with any tracked event</strong></div>
            <span className="badge">{totalUsers}</span>
          </div>
          <div className="history-row">
            <div className="flex-1"><strong>Total events logged</strong></div>
            <span className="badge">{events.length}{events.length === 1000 ? "+" : ""}</span>
          </div>
        </div>
      </section>

      <section className="stack">
        <span className="card-label">Recent events</span>
        <div className="card">
          {recent.length === 0 ? <p className="card-text">Nothing yet.</p> : null}
          {recent.map((e) => (
            <div className="history-row" key={e.id}>
              <div className="flex-1">
                <strong>{e.event_name}</strong>
                <p className="mt-1 text-sm text-muted-foreground">
                  {new Date(e.created_at).toLocaleString()} · {e.user_id ? `user ${e.user_id.slice(0, 8)}` : "anonymous"}
                  {Object.keys(e.metadata ?? {}).length > 0 ? ` · ${JSON.stringify(e.metadata)}` : ""}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
