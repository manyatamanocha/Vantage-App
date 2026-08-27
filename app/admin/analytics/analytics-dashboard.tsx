import { Users, CircleCheck, Repeat2, Star, ThumbsUp, Target, CalendarCheck, Activity } from "lucide-react";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  type MetricEvent,
  MEANINGFUL_EVENT,
  ACTIVE_WINDOW_DAYS,
  DORMANT_WINDOW_DAYS,
  WEL_THRESHOLD,
  activationFunnel,
  activationRate,
  engagementStatus,
  practiceCompletionRate,
  retentionRate,
  solutionFeedback,
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
 * Eight tiles and a funnel, in that order: the counts that say what happened,
 * then the rates that say how well, then the one chart that says where people
 * left. Every figure is a real computation from lib/analytics/metrics.ts —
 * there is no sample data anywhere in this file, and rates render "—" rather
 * than 0% when nobody is eligible to be measured yet.
 *
 * Still computed and unit-tested in metrics.ts but not rendered: 4-week habit
 * retention, D2 return, practice conversion, practice start rate, per-surface
 * breakdown. Not an oversight — a permanently-empty tile reads as broken
 * rather than as pending, and twenty numbers hide the three that matter.
 * Promote them into the grid as the data matures; nothing needs rebuilding.
 *
 * Also absent, and worth stating: Skill Improvement Rate needs a validated
 * scoring rubric before it measures skill rather than users learning to game
 * the quiz, and Referral Rate has no referral system to measure.
 */

// Activation needs each user's original signup, so the fetch is time-bounded
// rather than "latest N rows", which would silently truncate old signups.
const LOOKBACK_DAYS = 60;
const ROW_CAP = 5000;

// The palette has no amber token, but /admin/users already uses this exact
// hex for its "Inactive" bar — reusing it keeps the two admin surfaces
// consistent rather than introducing a fifth accent.
const AMBER = "#F59E0B";

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
  const engagement = engagementStatus(events, now);
  const feedback = solutionFeedback(events);
  const d7 = retentionRate(events, 7, now);
  const funnel = activationFunnel(events, now);
  const sessions = events.filter((e) => e.event_name === MEANINGFUL_EVENT).length;

  const funnelTop = Math.max(1, ...funnel.map((s) => s.users));
  const hasEvents = events.length > 0;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-5 py-8 sm:px-8 sm:py-12">
      <header>
        <div className="topline"><span className="datechip">{eyebrow}</span></div>
        <h1 className="display">Metrics</h1>
        <p className="lede">
          Real usage events, last {LOOKBACK_DAYS} days. Rates read &ldquo;—&rdquo; until enough users are
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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricTile
            icon={Users}
            label="Signups"
            value={String(funnel[0].users)}
            sub="People who joined"
          />
          <MetricTile
            icon={CircleCheck}
            label="Activated"
            // Not `activation.activated` directly: with an empty eligible
            // cohort that renders a hard 0, which reads as "nobody activated"
            // when the truth is "nobody is old enough to say yet".
            value={activation.signups === 0 ? null : String(activation.activated)}
            accent="var(--success)"
            sub={
              activation.signups === 0
                ? "No signups past their 24h window yet"
                : `${pct(activation.rate) ?? "—"} of ${activation.signups} eligible`
            }
            why="Practised within 24h of signing up. Signups still inside their own 24h window are excluded from both sides, so a burst of fresh signups can't drag this down."
          />
          <MetricTile
            icon={Repeat2}
            label="Sessions"
            value={String(sessions)}
            accent={AMBER}
            sub="Practice loops completed"
            why="Counts completed loops, not logins or page views — the learner submitted their own reasoning and reached the feedback step."
          />
          <MetricTile
            star
            icon={Star}
            label="Engaged"
            value={String(wel.count)}
            sub={`${WEL_THRESHOLD}+ sessions in ${ACTIVE_WINDOW_DAYS} days`}
            why="The North Star. A weekly-habit metric by design — a single day of testing cannot move it, and that is expected rather than a miss. Kept as an absolute count, never a ratio, so it can't improve just because casual users left."
          />

          <MetricTile
            icon={ThumbsUp}
            label="Helpful"
            value={pct(feedback.rate)}
            accent="var(--success)"
            sub={`of ${feedback.total} rated`}
            why="The only in-app qualitative signal — “Was this helpful?” on the solution screen. Read the count alongside it: 100% off two answers is not the same claim as off fifty."
          />
          <MetricTile
            icon={Target}
            label="Completion"
            value={pct(completion.rate)}
            accent={AMBER}
            sub={`${completion.completed} of ${completion.started} finished`}
            why="Of the people who begin loops, how many reach the feedback step. If this is low, people are abandoning at the guess — the core mechanic is the friction. Counted per user, not per event, since quiz surfaces fire one completion per question but one start per session."
          />
          <MetricTile
            icon={CalendarCheck}
            label="D7 return"
            value={pct(d7.rate)}
            accent="var(--destructive)"
            sub={d7.cohort === 0 ? "Nobody old enough to measure yet" : `${d7.retained} of ${d7.cohort} eligible`}
            why={`Activated users who practised again around day 7 (days ${d7.bracket[0]}–${d7.bracket[1]}). The cohort excludes anyone whose day-7 window hasn't elapsed, so this stays empty rather than reading as churn until users are old enough to measure.`}
          />
          <MetricTile
            icon={Activity}
            label="Active now"
            value={String(engagement.active)}
            sub={`${engagement.inactive} quiet · ${engagement.dormant} dormant`}
            why={`Active = practised in the last ${ACTIVE_WINDOW_DAYS} days. Dormant = nothing in ${DORMANT_WINDOW_DAYS}. The middle bucket is quiet-this-week, kept separate so a normal weekly gap isn't misread as churn.`}
          />
        </div>
      </section>

      <section className="stack">
        <span className="card-label">Activation funnel — where people drop</span>
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

      {truncated ? (
        <p className="hint" style={{ marginTop: 4 }}>
          Showing the most recent {ROW_CAP.toLocaleString()} events of the last {LOOKBACK_DAYS} days —
          older events in this window are excluded. Aggregate in SQL before this matters.
        </p>
      ) : null}
    </main>
  );
}
