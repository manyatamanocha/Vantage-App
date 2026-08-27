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
  hoursUntilActivationMeasurable,
  practiceCompletionRate,
  restrictToSignupCohort,
  retentionRate,
  sessionDistribution,
  sessionsBySurface,
  solutionFeedback,
  surfaceBreakdown,
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

// Event metadata carries slugs; a dashboard shouldn't. These are the four
// surfaces that actually appear in the table, plus a fallback for anything a
// future surface fires before it's named here.
const SURFACE_LABELS: Record<string, string> = {
  solve: "Solve",
  daily_challenge: "Daily challenge",
  quiz_general: "Quiz Time",
  quiz_scenario: "Scenario quiz",
  unknown: "Unrecorded",
};

/** "in about 3 hours" / "in under an hour" — never a clock time. */
function waitPhrase(hours: number): string {
  if (hours < 1) return "in under an hour";
  const rounded = Math.round(hours);
  return `in about ${rounded} hour${rounded === 1 ? "" : "s"}`;
}

function surfaceLabel(source: string): string {
  return SURFACE_LABELS[source] ?? source.replace(/_/g, " ");
}

/** Day-by-day counts, oldest first, for the drill-down under a total. */
function countByDay(events: MetricEvent[]): { label: string; value: number }[] {
  const counts = new Map<string, number>();
  for (const event of events) {
    const day = event.created_at.slice(0, 10);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, value]) => ({
      label: new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      }),
      value,
    }));
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

  const fetched = (data ?? []) as MetricEvent[];
  const truncated = fetched.length === ROW_CAP;

  // Every figure below is computed over the signup cohort, so the tiles and the
  // funnel can never disagree about the same measure. See restrictToSignupCohort.
  const events = restrictToSignupCohort(fetched);
  const excluded = new Set(
    fetched.filter((e) => e.user_id).map((e) => e.user_id as string)
  ).size - new Set(events.map((e) => e.user_id as string)).size;

  const wel = weeklyEngagedLearners(events, now);
  const activation = activationRate(events, now);
  const completion = practiceCompletionRate(events, now);
  const engagement = engagementStatus(events, now);
  const feedback = solutionFeedback(events);
  const d7 = retentionRate(events, 7, now);
  const funnel = activationFunnel(events, now);
  const activationWait = hoursUntilActivationMeasurable(events, now);
  const sessions = events.filter((e) => e.event_name === MEANINGFUL_EVENT).length;

  const funnelTop = Math.max(1, ...funnel.map((s) => s.users));
  const hasEvents = events.length > 0;

  // Drill-downs. Each is the decomposition of the tile directly above it, so a
  // reader who doubts a number can open it rather than take it on faith — the
  // headline says what happened, the breakdown says where it came from.
  const bySurface = sessionsBySurface(events);
  const distribution = sessionDistribution(events, now);
  const perSurface = surfaceBreakdown(events, now);
  const pending = funnel[0].users - activation.signups;

  const signupBreakdown = countByDay(events.filter((e) => e.event_name === "signup" && e.user_id));
  const activationBreakdown = [
    { label: "Practised on day one", value: activation.activated },
    { label: "Didn't", value: activation.signups - activation.activated },
    { label: "Still in their first day", value: pending },
  ].filter((row) => row.value > 0);
  const sessionBreakdown = bySurface.map((s) => ({ label: surfaceLabel(s.source), value: s.sessions }));
  const engagedBreakdown = distribution.map((b) => ({ label: b.bucket, value: b.users }));
  const feedbackBreakdown = [
    { label: "Helpful", value: feedback.helpful },
    { label: "Not helpful", value: feedback.notHelpful },
  ].filter((row) => row.value > 0);
  const completionBreakdown = perSurface.map((s) => ({
    label: `${surfaceLabel(s.source)} — ${s.completed}/${s.started}`,
    value: s.completed,
  }));
  const d7Breakdown = [
    { label: "Came back", value: d7.retained },
    { label: "Didn't", value: d7.cohort - d7.retained },
    { label: "Week not elapsed", value: funnel[2].users - d7.cohort },
  ].filter((row) => row.value > 0);
  const engagementBreakdown = [
    { label: `Active (${ACTIVE_WINDOW_DAYS}d)`, value: engagement.active },
    { label: "Quiet this week", value: engagement.inactive },
    { label: `Dormant (${DORMANT_WINDOW_DAYS}d)`, value: engagement.dormant },
  ].filter((row) => row.value > 0);

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
            breakdown={signupBreakdown}
          />
          <MetricTile
            icon={CircleCheck}
            // "Activated" and "24h" both read as jargon to the person this is
            // for — "24h" was misread as the 24th of the month. The name comes
            // from the vocabulary already on this screen: the funnel step below
            // measuring the same thing says "Completed first session", so the
            // tile says the same words rather than making a reader translate.
            // The precise name (Activation / First Value Rate) is in the ⓘ.
            label="First session"
            // Not `activation.activated` directly: with an empty eligible
            // cohort that renders a hard 0, which reads as "nobody activated"
            // when the truth is "nobody is old enough to say yet".
            value={activation.signups === 0 ? null : String(activation.activated)}
            accent="var(--success)"
            // Every sub-line leads with WHAT is measured, then the count or the
            // reason it can't be measured yet. A tile showing only "— / D7
            // RETURN / nobody old enough" tells a reader neither what the
            // metric is nor why it's blank without opening the ⓘ.
            // The sub-line has to finish the sentence the big number starts,
            // naming both sides: "9" alone says nothing, "of 16 who joined,
            // practised on day one" says what 9 is. When there's no number
            // yet, it says why and when instead of restating the definition.
            sub={
              activation.signups === 0
                ? `Everyone joined less than a day ago — check back ${
                    activationWait === null ? "soon" : waitPhrase(activationWait)
                  }`
                : `out of ${activation.signups} who joined (${pct(activation.rate) ?? "—"})`
            }
            why="How many people who signed up actually practised on the day they joined — the first test of whether joining leads to any value at all, and the number to watch if signups climb while usage doesn't. Anyone who joined less than 24 hours ago is left out of both the top and the bottom of the figure, so a fresh burst of signups can't drag it down; that's why it reads blank until the earliest signups pass their first day. Known formally as Activation, or First Value Rate."
            breakdown={activationBreakdown}
          />
          <MetricTile
            icon={Repeat2}
            label="Sessions"
            value={String(sessions)}
            accent={AMBER}
            sub="Practice loops completed"
            breakdown={sessionBreakdown}
            why="Counts completed loops, not logins or page views — the learner submitted their own reasoning and reached the feedback step."
          />
          <MetricTile
            star
            icon={Star}
            label="Engaged"
            value={String(wel.count)}
            sub={`${WEL_THRESHOLD}+ sessions in ${ACTIVE_WINDOW_DAYS} days`}
            breakdown={engagedBreakdown}
            why="The North Star. A weekly-habit metric by design — a single day of testing cannot move it, and that is expected rather than a miss. Kept as an absolute count, never a ratio, so it can't improve just because casual users left."
          />

          <MetricTile
            icon={ThumbsUp}
            label="Helpful"
            value={pct(feedback.rate)}
            accent="var(--success)"
            sub={`Rated the solution useful · of ${feedback.total} rated`}
            why="The only in-app qualitative signal — “Was this helpful?” on the solution screen. Read the count alongside it: 100% off two answers is not the same claim as off fifty."
            breakdown={feedbackBreakdown}
          />
          <MetricTile
            icon={Target}
            label="Completion"
            value={pct(completion.rate)}
            accent={AMBER}
            sub={`Began a loop and reached feedback · ${completion.completed} of ${completion.started}`}
            why="Of the people who begin loops, how many reach the feedback step. If this is low, people are abandoning at the guess — the core mechanic is the friction. Counted per user, not per event, since quiz surfaces fire one completion per question but one start per session."
            breakdown={completionBreakdown}
          />
          <MetricTile
            icon={CalendarCheck}
            // Plain on the face, precise in the popover. "D7" was unreadable
            // to the person this dashboard is for, and Metrics.md keeps D2
            // RETURN (leading) separate from D7 RETENTION (lagging) — so the
            // ⓘ names it "D7 retention" exactly, and the tile says what that
            // means in English. The PRD row still maps one-to-one.
            label="Back after a week"
            value={pct(d7.rate)}
            accent="var(--destructive)"
            sub={
              d7.cohort === 0
                ? `Practised again around day ${d7.bracket[0]}–${d7.bracket[1]} · nobody eligible yet`
                : `Practised again around day ${d7.bracket[0]}–${d7.bracket[1]} · ${d7.retained} of ${d7.cohort}`
            }
            why={`D7 retention. Activated users who practised again around day 7 (days ${d7.bracket[0]}–${d7.bracket[1]}). The cohort excludes anyone whose day-7 window hasn't elapsed, so this stays empty rather than reading as churn until users are old enough to measure.`}
            breakdown={d7Breakdown}
          />
          <MetricTile
            icon={Activity}
            label="Active now"
            value={String(engagement.active)}
            sub={`Practised in the last ${ACTIVE_WINDOW_DAYS} days · ${engagement.inactive} quiet · ${engagement.dormant} dormant`}
            why={`Active = practised in the last ${ACTIVE_WINDOW_DAYS} days. Dormant = nothing in ${DORMANT_WINDOW_DAYS}. The middle bucket is quiet-this-week, kept separate so a normal weekly gap isn't misread as churn.`}
            breakdown={engagementBreakdown}
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

      {excluded > 0 ? (
        <p className="hint" style={{ marginTop: 4 }}>
          {excluded} account{excluded === 1 ? "" : "s"} with activity but no signup record
          {excluded === 1 ? " is" : " are"} excluded from every figure above — accounts predating
          this table can&rsquo;t be placed in an activation or retention cohort. Separated out rather
          than folded into the headline numbers.
        </p>
      ) : null}

      {truncated ? (
        <p className="hint" style={{ marginTop: 4 }}>
          Showing the most recent {ROW_CAP.toLocaleString()} events of the last {LOOKBACK_DAYS} days —
          older events in this window are excluded. Aggregate in SQL before this matters.
        </p>
      ) : null}
    </main>
  );
}
