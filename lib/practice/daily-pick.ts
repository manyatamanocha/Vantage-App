/**
 * Deterministic per-day practice-case selection.
 *
 * Kept out of `app/practice/today/actions.ts` because that file is `"use server"`,
 * where every export must be an async server action — a pure helper cannot live
 * there, and it is the only part of the selection worth unit-testing on its own.
 */

/** `YYYY-MM-DD` in UTC. One key per calendar day, the same for every server. */
export function utcDayKey(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/**
 * FNV-1a over the seed, reduced into `[0, length)`.
 *
 * Requirements this satisfies, and why it is this rather than something fancier:
 * the same seed must always give the same index (so a user sees one case all
 * day, across reloads and across server instances — no state stored anywhere),
 * and a different day or a different user must scatter (so two users don't march
 * through the pool in lockstep). A non-cryptographic hash is entirely sufficient:
 * nothing here is a secret and there is no adversary to defend against.
 */
export function pickDailyIndex(seed: string, length: number): number {
  if (!Number.isInteger(length) || length <= 0) {
    throw new Error("pickDailyIndex needs a positive length");
  }
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash % length;
}

/** The seed a given user's given day hashes from. */
export function dailySeed(dayKey: string, userId: string): string {
  return `${dayKey}:${userId}`;
}
