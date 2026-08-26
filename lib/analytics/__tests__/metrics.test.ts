import { describe, it, expect } from "vitest";
import {
  type MetricEvent,
  activationRate,
  engagementStatus,
  activationFunnel,
  habitRetention,
  practiceStartRate,
  practiceCompletionRate,
  practiceConversionRate,
  retentionRate,
  solutionFeedback,
  weeklyEngagedLearners,
} from "../metrics";

const NOW = new Date("2026-03-20T12:00:00.000Z");

/** Builds an event `daysAgo` days before NOW (fractional days allowed). */
function ev(
  event_name: string,
  user_id: string | null,
  daysAgo: number,
  metadata: Record<string, unknown> = {}
): MetricEvent {
  return {
    event_name,
    user_id,
    created_at: new Date(NOW.getTime() - daysAgo * 86_400_000).toISOString(),
    metadata,
  };
}

const meaningful = (user: string, daysAgo: number, source = "solve") =>
  ev("meaningful_activity_completed", user, daysAgo, { source });

describe("weeklyEngagedLearners", () => {
  it("counts a user with exactly the 3-session threshold", () => {
    const events = [meaningful("u1", 1), meaningful("u1", 2), meaningful("u1", 3)];
    expect(weeklyEngagedLearners(events, NOW).count).toBe(1);
  });

  it("excludes a user one session below the threshold", () => {
    const events = [meaningful("u1", 1), meaningful("u1", 2)];
    expect(weeklyEngagedLearners(events, NOW).count).toBe(0);
  });

  it("ignores sessions outside the rolling 7-day window", () => {
    // Two inside, one 8 days old — should not reach the threshold.
    const events = [meaningful("u1", 1), meaningful("u1", 2), meaningful("u1", 8)];
    expect(weeklyEngagedLearners(events, NOW).count).toBe(0);
  });

  it("does not count non-meaningful events toward the threshold", () => {
    const events = [
      meaningful("u1", 1),
      ev("login", "u1", 1),
      ev("practice_started", "u1", 1),
      ev("solve_started", "u1", 1),
    ];
    expect(weeklyEngagedLearners(events, NOW).count).toBe(0);
  });

  it("counts distinct users, not sessions", () => {
    const events = [
      meaningful("u1", 1), meaningful("u1", 2), meaningful("u1", 3),
      meaningful("u2", 1), meaningful("u2", 2), meaningful("u2", 3),
    ];
    expect(weeklyEngagedLearners(events, NOW).count).toBe(2);
  });

  it("ignores events with no user id", () => {
    const events = [meaningful(null as unknown as string, 1), meaningful("u1", 1)];
    expect(weeklyEngagedLearners(events, NOW).count).toBe(0);
  });
});

describe("activationRate", () => {
  it("counts a signup whose first meaningful session lands inside 24h", () => {
    const events = [ev("signup", "u1", 3), meaningful("u1", 2.5)];
    const result = activationRate(events, NOW);
    expect(result).toMatchObject({ signups: 1, activated: 1, rate: 1 });
  });

  it("excludes a signup whose first session came after 24h", () => {
    const events = [ev("signup", "u1", 5), meaningful("u1", 3)];
    expect(activationRate(events, NOW)).toMatchObject({ signups: 1, activated: 0, rate: 0 });
  });

  it("excludes a signup that never practised", () => {
    expect(activationRate([ev("signup", "u1", 3)], NOW)).toMatchObject({ activated: 0, rate: 0 });
  });

  it("ignores signups too recent to have had their full 24h", () => {
    // Signed up 6h ago — hasn't had a fair chance yet, so must not drag the rate down.
    const events = [ev("signup", "u1", 0.25), ev("signup", "u2", 3), meaningful("u2", 2.9)];
    expect(activationRate(events, NOW)).toMatchObject({ signups: 1, activated: 1, rate: 1 });
  });

  it("returns a null rate when no signup is eligible yet", () => {
    expect(activationRate([ev("signup", "u1", 0.1)], NOW).rate).toBeNull();
  });
});

describe("retentionRate", () => {
  it("counts an activated user active inside the D7 bracket", () => {
    const events = [
      ev("signup", "u1", 20), meaningful("u1", 19.5), // activated at ~day 0.5
      meaningful("u1", 13),                            // ~7 days after activation
    ];
    expect(retentionRate(events, 7, NOW)).toMatchObject({ cohort: 1, retained: 1, rate: 1 });
  });

  it("excludes an activated user who never returned in the bracket", () => {
    const events = [ev("signup", "u1", 20), meaningful("u1", 19.5)];
    expect(retentionRate(events, 7, NOW)).toMatchObject({ cohort: 1, retained: 0, rate: 0 });
  });

  it("excludes users whose bracket has not fully elapsed", () => {
    // Activated 2 days ago: their D7 window is still in the future, so they
    // must not be counted as a churned member of the cohort.
    const events = [ev("signup", "u1", 2.1), meaningful("u1", 2)];
    expect(retentionRate(events, 7, NOW)).toMatchObject({ cohort: 0, rate: null });
  });

  it("does not count activity before the bracket opens as retention", () => {
    const events = [
      ev("signup", "u1", 20), meaningful("u1", 19.5),
      meaningful("u1", 18), // ~day 1.5 — real, but not D7 retention
    ];
    expect(retentionRate(events, 7, NOW)).toMatchObject({ retained: 0 });
  });
});

describe("engagementStatus", () => {
  it("splits users into active, inactive and dormant by last meaningful activity", () => {
    const events = [
      ev("signup", "active", 40), meaningful("active", 2),
      ev("signup", "inactive", 40), meaningful("inactive", 15),
      ev("signup", "dormant", 60), meaningful("dormant", 40),
      ev("signup", "never", 60),
    ];
    const result = engagementStatus(events, NOW);
    expect(result.active).toBe(1);
    expect(result.inactive).toBe(1);
    // Never-practised users are dormant too: 0 activity in 28 days.
    expect(result.dormant).toBe(2);
  });

  it("treats a login without practice as not active", () => {
    const events = [ev("signup", "u1", 30), ev("login", "u1", 1)];
    expect(engagementStatus(events, NOW).active).toBe(0);
  });
});

describe("practiceConversionRate", () => {
  it("divides practising users by users with any session in the window", () => {
    const events = [
      ev("login", "u1", 1), meaningful("u1", 1),
      ev("login", "u2", 1),
      ev("login", "u3", 2), meaningful("u3", 2),
    ];
    expect(practiceConversionRate(events, NOW)).toMatchObject({ sessioned: 3, practised: 2 });
  });

  it("counts a user once no matter how many times they logged in", () => {
    const events = [ev("login", "u1", 1), ev("login", "u1", 2), ev("login", "u1", 3)];
    expect(practiceConversionRate(events, NOW).sessioned).toBe(1);
  });
});

describe("practiceStartRate", () => {
  it("counts an activated user who began another practice inside the 7-day window", () => {
    const events = [
      ev("signup", "u1", 20), meaningful("u1", 19),   // activated ~day 0
      ev("practice_started", "u1", 16),                // ~3 days later
    ];
    expect(practiceStartRate(events, NOW)).toMatchObject({ cohort: 1, restarted: 1, rate: 1 });
  });

  it("does not count the start that belongs to the activating session itself", () => {
    // The loop they activated ON started just before it completed — that is
    // not "came back and started another".
    const events = [
      ev("signup", "u1", 20),
      ev("practice_started", "u1", 19.01),
      meaningful("u1", 19),
    ];
    expect(practiceStartRate(events, NOW)).toMatchObject({ cohort: 1, restarted: 0 });
  });

  it("ignores a restart that falls outside the 7-day window", () => {
    const events = [
      ev("signup", "u1", 30), meaningful("u1", 29),
      ev("practice_started", "u1", 20), // ~9 days after activating
    ];
    expect(practiceStartRate(events, NOW)).toMatchObject({ cohort: 1, restarted: 0 });
  });

  it("excludes users whose 7-day window has not elapsed", () => {
    const events = [ev("signup", "u1", 2.1), meaningful("u1", 2)];
    expect(practiceStartRate(events, NOW)).toMatchObject({ cohort: 0, rate: null });
  });
});

describe("habitRetention", () => {
  it("counts a week-1 engaged learner still engaged in week 4", () => {
    const events = [
      ev("signup", "u1", 40),
      // week 1 (days 0-7 after activation ~day 39 ago): 3 sessions
      meaningful("u1", 39), meaningful("u1", 38), meaningful("u1", 37),
      // week 4 (days 21-28 after activation): 3 more
      meaningful("u1", 16), meaningful("u1", 15), meaningful("u1", 14),
    ];
    expect(habitRetention(events, NOW)).toMatchObject({ cohort: 1, retained: 1, rate: 1 });
  });

  it("excludes someone who was never engaged in week 1", () => {
    // Only 2 sessions in week 1 — below the WEL threshold, so not in the cohort.
    const events = [
      ev("signup", "u1", 40),
      meaningful("u1", 39), meaningful("u1", 38),
      meaningful("u1", 16), meaningful("u1", 15), meaningful("u1", 14),
    ];
    expect(habitRetention(events, NOW)).toMatchObject({ cohort: 0, rate: null });
  });

  it("counts a week-1 learner who dropped off by week 4 as lost", () => {
    const events = [
      ev("signup", "u1", 40),
      meaningful("u1", 39), meaningful("u1", 38), meaningful("u1", 37),
    ];
    expect(habitRetention(events, NOW)).toMatchObject({ cohort: 1, retained: 0, rate: 0 });
  });

  it("excludes users whose week 4 has not arrived yet", () => {
    const events = [
      ev("signup", "u1", 8),
      meaningful("u1", 7), meaningful("u1", 6), meaningful("u1", 5),
    ];
    expect(habitRetention(events, NOW)).toMatchObject({ cohort: 0, rate: null });
  });
});

describe("solutionFeedback", () => {
  it("splits helpful from not-helpful and reports the share", () => {
    const events = [
      ev("solution_feedback", "u1", 1, { helpful: true }),
      ev("solution_feedback", "u2", 1, { helpful: true }),
      ev("solution_feedback", "u3", 1, { helpful: false }),
    ];
    expect(solutionFeedback(events)).toMatchObject({ helpful: 2, notHelpful: 1, total: 3 });
  });

  it("returns a null rate when nobody has answered", () => {
    expect(solutionFeedback([meaningful("u1", 1)])).toMatchObject({ total: 0, rate: null });
  });
});

describe("activationFunnel", () => {
  it("counts submitting an ask as having started an activity", () => {
    // ask_submitted is the earliest real "began something" signal in Solve —
    // a user who typed an ask but never confirmed must still appear as started.
    const events = [ev("signup", "u1", 2), ev("ask_submitted", "u1", 1)];
    const started = activationFunnel(events, NOW).find((s) => s.step === "Started a practice");
    expect(started?.users).toBe(1);
  });

  it("does not double-count a Solve user who fired both start events", () => {
    const events = [
      ev("signup", "u1", 2),
      ev("ask_submitted", "u1", 1),
      ev("solve_started", "u1", 1),
    ];
    const started = activationFunnel(events, NOW).find((s) => s.step === "Started a practice");
    expect(started?.users).toBe(1);
  });
});

describe("practiceCompletionRate", () => {
  it("ignores ask_submitted so a Solve loop counts as one start, not two", () => {
    const events = [
      ev("ask_submitted", "u1", 1),
      ev("solve_started", "u1", 1),
      meaningful("u1", 1),
    ];
    expect(practiceCompletionRate(events, NOW)).toMatchObject({ started: 1, completed: 1, rate: 1 });
  });

  it("divides completed sessions by started sessions", () => {
    const events = [
      ev("practice_started", "u1", 1), meaningful("u1", 1),
      ev("practice_started", "u1", 2),
      ev("solve_started", "u2", 1), meaningful("u2", 1),
    ];
    expect(practiceCompletionRate(events, NOW)).toMatchObject({ started: 3, completed: 2 });
  });

  it("returns a null rate rather than dividing by zero", () => {
    expect(practiceCompletionRate([], NOW).rate).toBeNull();
  });
});
