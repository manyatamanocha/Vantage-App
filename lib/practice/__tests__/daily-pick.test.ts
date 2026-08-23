import { describe, it, expect } from "vitest";
import { dailySeed, pickDailyIndex, utcDayKey } from "../daily-pick";

describe("utcDayKey", () => {
  it("is the UTC calendar date, not the local one", () => {
    expect(utcDayKey(new Date("2026-08-23T23:59:59.000Z"))).toBe("2026-08-23");
    expect(utcDayKey(new Date("2026-08-24T00:00:01.000Z"))).toBe("2026-08-24");
  });
});

describe("pickDailyIndex", () => {
  it("always returns the same index for the same seed", () => {
    const seed = dailySeed("2026-08-23", "user-1");
    const first = pickDailyIndex(seed, 11);
    for (let i = 0; i < 50; i += 1) {
      expect(pickDailyIndex(seed, 11)).toBe(first);
    }
  });

  it("stays inside the candidate set", () => {
    for (let day = 1; day <= 28; day += 1) {
      const seed = dailySeed(`2026-02-${String(day).padStart(2, "0")}`, "user-1");
      const index = pickDailyIndex(seed, 11);
      expect(index).toBeGreaterThanOrEqual(0);
      expect(index).toBeLessThan(11);
    }
  });

  it("moves the user off today's case on at least some following days", () => {
    // Not "every day differs" — an 11-case pool will repeat by chance, and
    // pretending otherwise would be a false claim about a hash. What matters is
    // that the pick is a function of the day at all, which a fixed `.limit(1)`
    // was not: it returned the same row forever.
    const today = pickDailyIndex(dailySeed("2026-08-23", "user-1"), 11);
    const followingWeek = Array.from({ length: 7 }, (_, offset) =>
      pickDailyIndex(dailySeed(`2026-08-${24 + offset}`, "user-1"), 11)
    );
    expect(followingWeek.some((index) => index !== today)).toBe(true);
  });

  it("does not march every user through the pool in lockstep", () => {
    const day = "2026-08-23";
    const indexes = new Set(
      Array.from({ length: 20 }, (_, i) => pickDailyIndex(dailySeed(day, `user-${i}`), 11))
    );
    expect(indexes.size).toBeGreaterThan(1);
  });

  it("distributes across the whole pool rather than favouring one slot", () => {
    const seen = new Set<number>();
    for (let i = 0; i < 500; i += 1) {
      seen.add(pickDailyIndex(dailySeed("2026-08-23", `user-${i}`), 11));
    }
    expect(seen.size).toBe(11);
  });

  it("refuses an empty candidate set rather than returning a bogus index", () => {
    expect(() => pickDailyIndex("seed", 0)).toThrow(/positive length/i);
  });
});
