import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  type MetricEvent,
  ACTIVE_WINDOW_DAYS,
  WEL_THRESHOLD,
  activationFunnel,
  activationRate,
  practiceCompletionRate,
  retentionRate,
  weeklyEngagedLearners,
} from "@/lib/analytics/metrics";
import { MetricTile } from "./metric-tile";

/**
 * Shared body for both the admin-gated dashboard (app/admin/analytics/page.tsx)
 * and the public read-only link (app/demo/analytics/page.tsx) — same real
 * events, same queries, same aggregate-only numbers. No per-user data (names,
 * emails) is queried or rendered here, which is what makes the public copy
 * safe to link without authentication.
 *
 * Four numbers, deliberately. The North Star plus the two rates that can
 * change a decision, over the funnel that says where people drop.
 *
 * The wider stack (D2/D7/D30 retention, 4-week habit retention, practice
 * conversion, engagement split, per-surface breakdown, solution feedback) is
 * still defined, computed and unit-tested in lib/analytics/metrics.ts — it is
 * simply not rendered. Two reasons, both deliberate:
 *   1. Retention metrics cannot have data in a product this young; a
 *      permanently-empty tile reads as broken, not as pending.
 *   2. A dashboard of twenty numbers hides the three that matter. The "So
 *      What?" test applies: if seeing it wouldn't change a decision today,
 *      it doesn't earn space today.
 * Re-surface them here as the data matures — nothing needs rebuilding.
 *
 * Also absent, and worth stating: Skill Improvement Rate needs a validated
 * scoring rubric before it measures skill rather than users learning to game
 * the quiz, and Referral Rate has no referral system to measure.
 */

// Activation needs each user's original signup, so the fetch is time-bounded
// rather than "latest N rows", which would silently truncate old signups.
const LOOKBACK_DAYS = 60;
const ROW_CAP = 5000;

function pct(rate: number | null): string | null {
  return rate === null ? null : `${Math.round(rate * 100)}%`;
}

export async function AnalyticsDashboard({ eyebrow = "Admin" }: { eyebrow?: string }) {
  const now = new Date();
  const since = new Date(now.getTime() - LOOKBACK_DAYS * 86_400_000).toISOString();

  const admin = getSupabaseAdminClient();
  const { data } = await admin
    .from("analytics_events")
    .select("event_name, user_id, metadata, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(ROW_CAP);

  const events = (data ?? []) as MetricEvent[];
  const truncated = events.length === ROW_CAP;

  const wel = weeklyEngagedLearners(events, now);
  const activation = activationRate(events, now);
  const completion = practiceCompletionRate(events, now);
  const d7 = retentionRate(events, 7, now);
  const funnel = activationFunnel(events, now);

  const funnelTop = Math.max(1, ...funnel.map((s) => s.users));
  const hasEvents = events.length > 0;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-5 py-8 sm:px-8 sm:py-12">
      <header>
        <div className="topline"><span className="datechip">{eyebrow}</span></div>
        <h1 className="display">Metrics</h1>
        <p className="lede">
          Real usage events only — no sample data. Rates read &ldquo;—&rdquo; until enough users are
          eligible to measure them.
        </p>
      </header>

      {!hasEvents ? (
        <section className="card" style={{ marginTop: 8 }}>
          <p className="card-text">
            No events recorded in the last {LOOKBACK_DAYS} days yet. Sign up, solve a problem, or
            complete a quiz to generate the first ones.
          </p>
        </section>
      ) : null}

      <section className="stack">
        <span className="card-label">Activation funnel — where people drop before the habit</span>
        <div className="card">
          <div className="bars">
            {funnel.map((step, i) => {
              const previous = i === 0 ? null : funnel[i - 1].users;
              const dropped = previous !== null && previous > 0 ? previous - step.users : 0;
              return (
                <div key={step.step} style={{ display: "grid", gridTemplateColumns: "1fr", gap: 5 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13 }}>
                    <span>{step.step}</span>
                    <span style={{ fontVariantNumeric: "tabular-nums", color: "var(--muted-foreground)" }}>
                      {step.users}
                      {dropped > 0 ? ` · −${dropped}` : ""}
                    </span>
                  </div>
                  <div className="bar-track" style={{ height: 10 }}>
                    <div
                      style={{
                        width: `${(step.users / funnelTop) * 100}%`,
                        height: "100%",
                        background: "var(--primary)",
                        borderRadius: 99,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="stack">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <MetricTile
            star
            label="Weekly Engaged Learners"
            value={String(wel.count)}
            sub={`Unique users completing ${WEL_THRESHOLD}+ meaningful sessions in a rolling ${ACTIVE_WINDOW_DAYS} days. A weekly-habit metric by design — a single day of testing cannot move it, and that is expected rather than a miss.`}
          />
          <MetricTile
            label="Activation — first value"
            value={pct(activation.rate)}
            accent="var(--success)"
            sub={`${activation.activated} of ${activation.signups} eligible signups practised within 24h. Signups still inside their own 24h window are excluded from both sides, so a burst of fresh signups can't drag this down.`}
          />
          <MetricTile
            label="Practice completion"
            value={pct(completion.rate)}
            accent="var(--accent2)"
            sub={`${completion.completed} of ${completion.started} started loops reached the feedback step this week. If this is low, people are abandoning at the guess — the core mechanic is the friction.`}
          />
        </div>
      </section>

      <section className="stack">
        <span className="card-label">Lagging — confirms whether the leading signals were real</span>
        <div className="card">
          <div className="history-row">
            <div className="flex-1">
              <strong>D7 retention</strong>
              <p className="mt-1 text-sm text-muted-foreground">
                Activated users who practised again around day 7 (days {d7.bracket[0]}–
                {d7.bracket[1]}). Cohort excludes anyone whose day-7 window hasn&apos;t elapsed —
                so this stays empty, rather than reading as churn, until users are old enough to
                measure.
              </p>
            </div>
            <span className="badge progress" style={{ fontVariantNumeric: "tabular-nums" }}>
              {pct(d7.rate) ?? "—"} · {d7.retained}/{d7.cohort}
            </span>
          </div>
        </div>
      </section>

      {truncated ? (
        <p className="hint" style={{ marginTop: 4 }}>
          Showing the most recent {ROW_CAP.toLocaleString()} events of the last {LOOKBACK_DAYS} days —
          older events in this window are excluded. Aggregate in SQL before this matters.
        </p>
      ) : null}
    </main>
  );
}
