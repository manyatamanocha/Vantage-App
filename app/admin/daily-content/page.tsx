import { requireAdmin } from "@/lib/auth/admin";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

const TIERS = ["easy", "medium", "hard"] as const;

function todayRangeUTC() {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

async function countsByTier(table: string, start: string, end: string) {
  const admin = getSupabaseAdminClient();
  const counts: Record<string, number> = { easy: 0, medium: 0, hard: 0 };
  const { data, error } = await admin
    .from(table)
    .select("difficulty")
    .gte("created_at", start)
    .lt("created_at", end);
  if (error) throw new Error(error.message);
  for (const row of data ?? []) {
    const d = row.difficulty as string;
    if (d in counts) counts[d] += 1;
  }
  return counts;
}

export default async function DailyContentPage() {
  await requireAdmin();
  const { start, end } = todayRangeUTC();
  const [general, scenario] = await Promise.all([
    countsByTier("general_quiz_questions", start, end),
    countsByTier("scenario_quiz_questions", start, end),
  ]);

  const rows = [
    { label: "Tech & AI quiz", counts: general },
    { label: "Scenario quiz", counts: scenario },
  ];

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 py-8 sm:px-8 sm:py-12">
      <header>
        <div className="topline"><span className="datechip">Admin</span></div>
        <h1 className="display">Daily content</h1>
        <p className="lede">Questions created today (UTC), by quiz type and tier. Read-only — no auto-generation is running yet.</p>
      </header>

      <section className="stack">
        <span className="card-label">Today&apos;s totals</span>
        <div className="card">
          {rows.map((row) => {
            const total = TIERS.reduce((sum, t) => sum + row.counts[t], 0);
            return (
              <div className="history-row" key={row.label}>
                <div className="flex-1">
                  <strong>{row.label}</strong>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {TIERS.map((t) => `${t}: ${row.counts[t]}`).join(" · ")}
                  </p>
                </div>
                <span className="badge">{total} total</span>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
