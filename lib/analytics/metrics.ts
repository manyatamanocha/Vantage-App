/**
 * Vantage's metrics stack, computed from the raw `analytics_events` table.
 *
 * Pure functions over an event list — no database, no React — so the window
 * and threshold arithmetic (the part that is easy to get subtly wrong) is
 * testable on its own. `/admin/analytics` is only a consumer.
 *
 * Definitions are locked per the product's metric review; the reasoning
 * behind each is worth keeping close to the code:
 *
 * - The NSM is an ABSOLUTE COUNT, never a ratio over active users. A ratio
 *   with an active-user denominator improves when casual users leave (100
 *   users / 30 power users = 30%, then 50 / 30 = 60% — the dashboard
 *   celebrates while the product reaches fewer people). Conversion is still
 *   tracked, but as a supporting metric, not the North Star.
 * - "Meaningful" excludes logins, page views and starting-but-not-finishing.
 *   Only `meaningful_activity_completed` counts: the learner submitted their
 *   own reasoning AND completed the feedback/reveal loop.
 * - Rates return `null`, never 0, when no one is eligible yet. An empty
 *   denominator is "unknown", and rendering it as 0% would read as failure.
 */

export type MetricEvent = {
  event_name: string;
  user_id: string | null;
  created_at: string;
  metadata?: Record<string, unknown> | null;
};

/** The one canonical "learner received the core value" event. */
export const MEANINGFUL_EVENT = "meaningful_activity_completed";
/**
 * Loop-start events, counted per SESSION (one per loop begun) — the
 * denominator for Practice Completion Rate. `solve_started` predates
 * `practice_started`; both count.
 *
 * `ask_submitted` is deliberately NOT here: in the Solve flow a user fires
 * `ask_submitted` and then `solve_started` for a single loop, so including it
 * would double-count starts and deflate the completion rate.
 */
export const START_EVENTS = ["practice_started", "solve_started"] as const;
/**
 * "Began an activity" at the USER level, for the funnel. Distinct users, so
 * the double-count above is harmless here — and submitting an ask genuinely
 * is starting an activity, which the session-level set can't express.
 */
export const ACTIVITY_START_EVENTS = [...START_EVENTS, "ask_submitted"] as const;
export const SIGNUP_EVENT = "signup";
export const FEEDBACK_EVENT = "solution_feedback";

/**
 * Sessions in 7 days that qualify a learner as "engaged". Three is a product
 * hypothesis, not scripture — it represents repeated practice without
 * demanding daily use. Revisit by cohorting 1 vs 2 vs 3+ vs 5+ sessions
 * against D30 retention once there is enough data to compare.
 */
export const WEL_THRESHOLD = 3;
export const ACTIVE_WINDOW_DAYS = 7;
/** Inactive is "quiet this week"; dormant is "probably gone". Not the same. */
export const DORMANT_WINDOW_DAYS = 28;
export const ACTIVATION_WINDOW_HOURS = 24;

const DAY_MS = 86_400_000;

type Rate = { rate: number | null };

function ratio(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator;
}

function time(event: MetricEvent): number {
  return new Date(event.created_at).getTime();
}

function isMeaningful(event: MetricEvent): boolean {
  return event.event_name === MEANINGFUL_EVENT;
}

function isStart(event: MetricEvent): boolean {
  return (START_EVENTS as readonly string[]).includes(event.event_name);
}

/** Events with a real user id, within `days` before `now`. */
function withinWindow(events: MetricEvent[], days: number, now: Date): MetricEvent[] {
  const cutoff = now.getTime() - days * DAY_MS;
  return events.filter((e) => e.user_id && time(e) >= cutoff);
}

function distinctUsers(events: MetricEvent[]): Set<string> {
  return new Set(events.filter((e) => e.user_id).map((e) => e.user_id as string));
}

/**
 * Each user's earliest timestamp per event name — the basis for activation
 * (first signup vs first meaningful session) and retention cohorts.
 */
function firstEventTimes(events: MetricEvent[], predicate: (e: MetricEvent) => boolean): Map<string, number> {
  const first = new Map<string, number>();
  for (const event of events) {
    if (!event.user_id || !predicate(event)) continue;
    const at = time(event);
    const existing = first.get(event.user_id);
    if (existing === undefined || at < existing) first.set(event.user_id, at);
  }
  return first;
}

/**
 * The population every metric on the dashboard is computed over: users with a
 * real `signup` row in the fetched window.
 *
 * Without this, two figures on one screen disagree about the same thing. The
 * funnel intersects each step with the signup cohort (so its steps are true
 * subsets), while the North Star counted anyone with activity — and the admin
 * account has practice events but no signup row, because its signup predates
 * the analytics table. One screen, "3+ sessions in 7 days" twice, 9 and 8.
 *
 * Excluding accounts that cannot be placed in a cohort is the honest reading
 * rather than a cosmetic reconciliation: a user with no signup has no
 * activation clock, no retention bracket, and no cohort to belong to, so every
 * rate here was already ignoring them on the denominator side.
 */
export function restrictToSignupCohort(events: MetricEvent[]): MetricEvent[] {
  const cohort = distinctUsers(events.filter((e) => e.event_name === SIGNUP_EVENT));
  return events.filter((e) => e.user_id !== null && cohort.has(e.user_id));
}

/**
 * ⭐ NORTH STAR — Weekly Engaged Learners.
 * Unique users completing >= WEL_THRESHOLD meaningful sessions in a rolling
 * 7-day window. Captures both value delivered and the repetition the product
 * exists to build.
 */
export function weeklyEngagedLearners(
  events: MetricEvent[],
  now: Date
): { count: number; sessionsByUser: Map<string, number> } {
  const sessionsByUser = new Map<string, number>();
  for (const event of withinWindow(events, ACTIVE_WINDOW_DAYS, now)) {
    if (!isMeaningful(event)) continue;
    const userId = event.user_id as string;
    sessionsByUser.set(userId, (sessionsByUser.get(userId) ?? 0) + 1);
  }
  let count = 0;
  for (const sessions of sessionsByUser.values()) {
    if (sessions >= WEL_THRESHOLD) count++;
  }
  return { count, sessionsByUser };
}

/**
 * ACTIVATION — First Value Rate: new users completing their first meaningful
 * session within 24h of signing up.
 *
 * Signups too recent to have had their full 24h are excluded from BOTH sides
 * of the ratio. Counting them would let a burst of fresh signups crater the
 * rate purely because their window is still open.
 */
export function activationRate(
  events: MetricEvent[],
  now: Date
): Rate & { signups: number; activated: number } {
  const signupAt = firstEventTimes(events, (e) => e.event_name === SIGNUP_EVENT);
  const firstMeaningfulAt = firstEventTimes(events, isMeaningful);
  const windowMs = ACTIVATION_WINDOW_HOURS * 3_600_000;

  let signups = 0;
  let activated = 0;
  for (const [userId, signedUp] of signupAt) {
    if (now.getTime() - signedUp < windowMs) continue; // window still open
    signups++;
    const practised = firstMeaningfulAt.get(userId);
    if (practised !== undefined && practised - signedUp <= windowMs) activated++;
  }
  return { signups, activated, rate: ratio(activated, signups) };
}

/**
 * LAGGING — D-N retention over the ACTIVATED cohort (not all signups: someone
 * who never reached value cannot be "retained").
 *
 * Uses BRACKET retention — active anywhere in day N±tolerance — rather than
 * "active on exactly day N", which is far too strict at this data volume.
 * Users whose bracket has not fully elapsed are excluded from the cohort, for
 * the same reason recent signups are excluded from activation.
 */
export function retentionRate(
  events: MetricEvent[],
  dayOffset: number,
  now: Date,
  toleranceDays = Math.max(2, Math.round(dayOffset * 0.2))
): Rate & { cohort: number; retained: number; bracket: [number, number] } {
  const firstMeaningfulAt = firstEventTimes(events, isMeaningful);
  const meaningfulByUser = new Map<string, number[]>();
  for (const event of events) {
    if (!event.user_id || !isMeaningful(event)) continue;
    const list = meaningfulByUser.get(event.user_id) ?? [];
    list.push(time(event));
    meaningfulByUser.set(event.user_id, list);
  }

  const bracketStart = dayOffset - toleranceDays;
  const bracketEnd = dayOffset + toleranceDays;

  let cohort = 0;
  let retained = 0;
  for (const [userId, activatedAt] of firstMeaningfulAt) {
    const bracketCloses = activatedAt + bracketEnd * DAY_MS;
    if (bracketCloses > now.getTime()) continue; // not yet had the chance
    cohort++;
    const opens = activatedAt + bracketStart * DAY_MS;
    const hit = (meaningfulByUser.get(userId) ?? []).some((at) => at >= opens && at <= bracketCloses);
    if (hit) retained++;
  }
  return { cohort, retained, rate: ratio(retained, cohort), bracket: [bracketStart, bracketEnd] };
}

/**
 * Active / inactive / dormant, defined by PRACTICE, not attendance — opening
 * the app, logging in, or browsing Settings must never make someone "active".
 * Inactive (quiet this week) and dormant (gone ~a month) are kept separate so
 * a normal weekly gap is not misread as churn.
 */
export function engagementStatus(
  events: MetricEvent[],
  now: Date
): { active: number; inactive: number; dormant: number; registered: number } {
  const registeredUsers = distinctUsers(events);
  const lastMeaningful = new Map<string, number>();
  for (const event of events) {
    if (!event.user_id || !isMeaningful(event)) continue;
    const at = time(event);
    const existing = lastMeaningful.get(event.user_id);
    if (existing === undefined || at > existing) lastMeaningful.set(event.user_id, at);
  }

  const activeCutoff = now.getTime() - ACTIVE_WINDOW_DAYS * DAY_MS;
  const dormantCutoff = now.getTime() - DORMANT_WINDOW_DAYS * DAY_MS;

  let active = 0;
  let inactive = 0;
  let dormant = 0;
  for (const userId of registeredUsers) {
    const last = lastMeaningful.get(userId);
    if (last !== undefined && last >= activeCutoff) active++;
    else if (last !== undefined && last >= dormantCutoff) inactive++;
    else dormant++;
  }
  return { active, inactive, dormant, registered: registeredUsers.size };
}

/**
 * SUPPORTING — how efficiently users who showed up reached value. Deliberately
 * NOT the NSM: this ratio rises when casual users stop showing up.
 * Counts users, not logins, so five logins is still one denominator entry.
 */
export function practiceConversionRate(
  events: MetricEvent[],
  now: Date
): Rate & { sessioned: number; practised: number } {
  const windowed = withinWindow(events, ACTIVE_WINDOW_DAYS, now);
  const sessioned = distinctUsers(windowed);
  const practised = distinctUsers(windowed.filter(isMeaningful));
  return { sessioned: sessioned.size, practised: practised.size, rate: ratio(practised.size, sessioned.size) };
}

/**
 * LEADING — of the people who begin loops, how many reach the feedback/reveal.
 *
 * Counted per USER, not per event, and that is deliberate. The quiz surfaces
 * fire one `meaningful_activity_completed` per QUESTION answered but only one
 * `practice_started` per SESSION, so a raw event ratio is not a rate at all —
 * on real data it read 148%. Distinct users who started, versus how many of
 * those reached the feedback step, is bounded by construction and answers the
 * question the tile actually asks: are people abandoning at the guess?
 *
 * Fixing this in the events instead (a session id threaded through both quiz
 * flows) would allow a true per-session rate. Until then, user-level is the
 * honest reading rather than a number that cannot be a percentage.
 */
export function practiceCompletionRate(
  events: MetricEvent[],
  now: Date
): Rate & { started: number; completed: number } {
  const windowed = withinWindow(events, ACTIVE_WINDOW_DAYS, now);
  const started = distinctUsers(windowed.filter(isStart));
  // The numerator is intersected with the denominator on purpose: a user with
  // a completion but no recorded start (legacy rows, or a loop begun before
  // the window opened) must not push the rate above 100%.
  const completed = [...distinctUsers(windowed.filter(isMeaningful))].filter((u) => started.has(u)).length;
  return { started: started.size, completed, rate: ratio(completed, started.size) };
}

/**
 * LEADING — D2 return: activated users practising again the next day. The
 * earliest signal that the loop is habit-forming, long before D7/D30 land.
 */
export function d2ReturnRate(events: MetricEvent[], now: Date): Rate & { cohort: number; returned: number } {
  const result = retentionRate(events, 2, now, 0.5);
  return { cohort: result.cohort, returned: result.retained, rate: result.rate };
}

/**
 * LEADING — Practice Start Rate: activated users who came back and began
 * another practice within 7 days of activating.
 *
 * Distinct from D2 Return in two ways: it counts a STARTED loop rather than a
 * completed one (so it catches intent even when the loop was abandoned), and
 * it uses a 7-day window rather than next-day. The start belonging to the
 * activating session itself is excluded — that isn't "came back".
 */
export function practiceStartRate(
  events: MetricEvent[],
  now: Date
): Rate & { cohort: number; restarted: number } {
  const activatedAt = firstEventTimes(events, isMeaningful);
  const startsByUser = new Map<string, number[]>();
  for (const event of events) {
    if (!event.user_id || !isStart(event)) continue;
    const list = startsByUser.get(event.user_id) ?? [];
    list.push(time(event));
    startsByUser.set(event.user_id, list);
  }

  const windowMs = ACTIVE_WINDOW_DAYS * DAY_MS;
  let cohort = 0;
  let restarted = 0;
  for (const [userId, activated] of activatedAt) {
    if (now.getTime() - activated < windowMs) continue; // window still open
    cohort++;
    // Strictly after activation: a start that preceded the activating
    // completion is part of that same loop, not a return visit.
    const came = (startsByUser.get(userId) ?? []).some(
      (at) => at > activated && at - activated <= windowMs
    );
    if (came) restarted++;
  }
  return { cohort, restarted, rate: ratio(restarted, cohort) };
}

/**
 * LAGGING — 4-week Habit Retention: of the users who hit the North Star bar in
 * their first week, how many still hit it in their fourth?
 *
 * The strongest signal in the stack that practice became a habit rather than a
 * novelty — and by construction the slowest, since a user needs four weeks of
 * history before they can appear in either side of the ratio.
 */
export function habitRetention(
  events: MetricEvent[],
  now: Date
): Rate & { cohort: number; retained: number } {
  const activatedAt = firstEventTimes(events, isMeaningful);
  const meaningfulByUser = new Map<string, number[]>();
  for (const event of events) {
    if (!event.user_id || !isMeaningful(event)) continue;
    const list = meaningfulByUser.get(event.user_id) ?? [];
    list.push(time(event));
    meaningfulByUser.set(event.user_id, list);
  }

  const WEEK_MS = 7 * DAY_MS;
  let cohort = 0;
  let retained = 0;
  for (const [userId, activated] of activatedAt) {
    // Week 4 must have fully elapsed, or the user cannot fairly be counted lost.
    if (now.getTime() < activated + 4 * WEEK_MS) continue;
    const sessions = meaningfulByUser.get(userId) ?? [];
    const inWindow = (from: number, to: number) =>
      sessions.filter((at) => at >= activated + from && at < activated + to).length;

    if (inWindow(0, WEEK_MS) < WEL_THRESHOLD) continue; // never engaged in week 1
    cohort++;
    if (inWindow(3 * WEEK_MS, 4 * WEEK_MS) >= WEL_THRESHOLD) retained++;
  }
  return { cohort, retained, rate: ratio(retained, cohort) };
}

/**
 * DIAGNOSTIC — the same start/complete pair split by surface, so a drop in the
 * North Star can be traced to WHERE the loop broke rather than just observed.
 *
 * Per USER within each surface, for the same reason as practiceCompletionRate:
 * quiz completions are per-question while starts are per-session, so counting
 * events would make the quiz surfaces uncomparable with Solve.
 */
export function surfaceBreakdown(
  events: MetricEvent[],
  now: Date
): { source: string; started: number; completed: number; rate: number | null }[] {
  const windowed = withinWindow(events, ACTIVE_WINDOW_DAYS, now);
  const startedBy = new Map<string, Set<string>>();
  const completedBy = new Map<string, Set<string>>();
  const add = (map: Map<string, Set<string>>, source: string, userId: string) => {
    const entry = map.get(source) ?? new Set<string>();
    entry.add(userId);
    map.set(source, entry);
  };
  for (const event of windowed) {
    if (!event.user_id) continue;
    const tagged = typeof event.metadata?.source === "string" ? event.metadata.source : "unknown";
    // `solve_started` carries the domain value ("live" / "practice") in
    // `source`, not a surface name — always attribute it to the Solve surface
    // rather than trusting the tag, so old rows group correctly too.
    if (isStart(event)) add(startedBy, event.event_name === "solve_started" ? "solve" : tagged, event.user_id);
    else if (isMeaningful(event)) add(completedBy, tagged, event.user_id);
  }
  return [...startedBy.entries()]
    .map(([source, starters]) => {
      const finishers = completedBy.get(source) ?? new Set<string>();
      const completed = [...finishers].filter((u) => starters.has(u)).length;
      return { source, started: starters.size, completed, rate: ratio(completed, starters.size) };
    })
    .sort((a, b) => b.started - a.started);
}

/**
 * DRILL-DOWN — the Sessions headline split by where the sessions happened.
 *
 * Counts SESSIONS, not users, unlike surfaceBreakdown: this exists to answer
 * "the 98 came from where?", so the parts must sum back to the headline. Not
 * windowed, for the same reason — it decomposes exactly the set the tile
 * counted, and a mismatch between a number and its own breakdown reads as a
 * bug even when both figures are right.
 */
export function sessionsBySurface(events: MetricEvent[]): { source: string; sessions: number }[] {
  const counts = new Map<string, number>();
  for (const event of events) {
    if (!isMeaningful(event)) continue;
    // Never dropped: a session with no surface tag is still a session, and
    // silently discarding it would break the sum against the headline.
    const source = typeof event.metadata?.source === "string" ? event.metadata.source : "unknown";
    counts.set(source, (counts.get(source) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([source, sessions]) => ({ source, sessions }))
    .sort((a, b) => b.sessions - a.sessions);
}

/**
 * DRILL-DOWN — how many sessions each engaged learner actually completed, as
 * buckets straddling the North Star's >= 3 threshold.
 *
 * The threshold is a hypothesis, not a finding (see WEL_THRESHOLD). Showing 1
 * and 2 next to 3–4 and 5+ is what makes it falsifiable: a pile of users at 2
 * says the bar is drawn in the wrong place, which the headline count alone can
 * never reveal. Empty buckets are omitted rather than rendered as zeroes.
 */
export function sessionDistribution(
  events: MetricEvent[],
  now: Date
): { bucket: string; users: number }[] {
  const { sessionsByUser } = weeklyEngagedLearners(events, now);
  const buckets = [
    { bucket: "1 session", match: (n: number) => n === 1 },
    { bucket: "2 sessions", match: (n: number) => n === 2 },
    { bucket: "3–4 sessions", match: (n: number) => n === 3 || n === 4 },
    { bucket: "5+ sessions", match: (n: number) => n >= 5 },
  ];
  return buckets
    .map(({ bucket, match }) => ({
      bucket,
      users: [...sessionsByUser.values()].filter(match).length,
    }))
    .filter((b) => b.users > 0);
}

/**
 * The product's only in-app qualitative signal: "Was this helpful?" on the
 * solution screen. Reported as a share of answers, plus the raw counts —
 * a 100% helpful rate off two responses is not the same claim as off fifty.
 */
export function solutionFeedback(
  events: MetricEvent[]
): Rate & { helpful: number; notHelpful: number; total: number } {
  let helpful = 0;
  let notHelpful = 0;
  for (const event of events) {
    if (event.event_name !== FEEDBACK_EVENT) continue;
    if (event.metadata?.helpful === true) helpful++;
    else notHelpful++;
  }
  const total = helpful + notHelpful;
  return { helpful, notHelpful, total, rate: ratio(helpful, total) };
}

/**
 * The activation funnel, as user counts per step. Each step is a strict subset
 * of the one before it, so the drop-off between any two steps is real.
 *
 * That subset property is enforced, not assumed: every step is intersected with
 * the signup cohort. Accounts that appear in the table without a `signup` row —
 * the admin account, whose activity predates admin exclusion, and anyone who
 * registered before this instrumentation existed — otherwise enter at step 2
 * and make it taller than step 1, turning the rendered drop-offs into
 * arithmetic on a user the funnel never counted.
 */
export function activationFunnel(
  events: MetricEvent[],
  now: Date
): { step: string; users: number }[] {
  const signedUp = distinctUsers(events.filter((e) => e.event_name === SIGNUP_EVENT));
  const started = new Set<string>();
  const meaningfulCounts = new Map<string, number>();
  for (const event of events) {
    if (!event.user_id || !signedUp.has(event.user_id)) continue;
    if ((ACTIVITY_START_EVENTS as readonly string[]).includes(event.event_name)) started.add(event.user_id);
    if (isMeaningful(event)) meaningfulCounts.set(event.user_id, (meaningfulCounts.get(event.user_id) ?? 0) + 1);
  }
  const atLeast = (n: number) => [...meaningfulCounts.values()].filter((c) => c >= n).length;
  const { sessionsByUser } = weeklyEngagedLearners(events, now);
  const threeInAWeek = [...sessionsByUser.entries()].filter(
    ([userId, count]) => count >= WEL_THRESHOLD && signedUp.has(userId)
  ).length;

  return [
    { step: "Signed up", users: signedUp.size },
    { step: "Started a practice", users: started.size },
    { step: "Completed first session", users: atLeast(1) },
    { step: "Came back for a second", users: atLeast(2) },
    { step: `${WEL_THRESHOLD} sessions in 7 days`, users: threeInAWeek },
  ];
}
