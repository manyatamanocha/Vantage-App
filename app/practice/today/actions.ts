"use server";
import { getVerifiedUser, getSupabaseServerClient } from "@/lib/supabase/server";
import { recommendCategory, type RevealResult } from "@/lib/engine/reveal";
import { isCategory } from "@/lib/engine/taxonomy";
import { dailySeed, pickDailyIndex, utcDayKey } from "@/lib/practice/daily-pick";
import { track } from "@/lib/analytics/track";

export type TodaysPracticeCase = {
  id: string;
  rawInput: string;
  industry?: string;
  difficulty: string;
  /** True when no case matched the user's preferred difficulty and the pool was widened. */
  matchedPreferredDifficulty: boolean;
};

const DEFAULT_DIFFICULTY = "medium";

/**
 * Picks the one case this user works today.
 *
 * Two properties matter and neither used to hold. It must respect the user's
 * `practice_difficulty` setting — previously that preference was write-only,
 * saved by the settings screen and read by nothing. And it must be stable for
 * the whole day but different tomorrow — previously it took `.limit(1)` with no
 * ordering, so Postgres' arbitrary row order decided, which in practice meant
 * every user saw the same single case forever.
 *
 * Selection is a pure function of (UTC date, user id, the ordered candidate
 * set), so nothing needs to be stored to remember "today's case" and two servers
 * handling the same user on the same day agree.
 */
export async function getTodaysPracticeCase(): Promise<TodaysPracticeCase> {
  const { supabase, user } = await getVerifiedUser();
  const userId = user?.id;
  if (!userId) throw new Error("Not authenticated");

  const { data: settings, error: settingsErr } = await supabase
    .from("user_settings")
    .select("practice_difficulty")
    .eq("user_id", userId)
    .maybeSingle();
  // `maybeSingle` so a user who has never opened Settings (nothing creates a
  // user_settings row at signup) falls back to the same default the DB column
  // itself declares, rather than erroring on zero rows.
  if (settingsErr) throw new Error(settingsErr.message);
  const preferred = settings?.practice_difficulty ?? DEFAULT_DIFFICULTY;

  const preferredPool = await fetchActiveCases(supabase, preferred);
  // A difficulty with no seeded cases must not mean "no practice today" — a
  // widened pool is strictly better than an empty screen.
  const matchedPreferredDifficulty = preferredPool.length > 0;
  const pool = matchedPreferredDifficulty
    ? preferredPool
    : await fetchActiveCases(supabase, null);

  if (pool.length === 0) {
    throw new Error(
      "No practice cases are available yet. Seed practice_cases before using the daily loop."
    );
  }

  const chosen = pool[pickDailyIndex(dailySeed(utcDayKey(), userId), pool.length)];
  return {
    id: chosen.id,
    rawInput: chosen.raw_input,
    industry: chosen.industry ?? undefined,
    difficulty: chosen.difficulty,
    matchedPreferredDifficulty,
  };
}

type PracticeCaseRow = {
  id: string;
  raw_input: string;
  industry: string | null;
  difficulty: string;
};

async function fetchActiveCases(
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>,
  difficulty: string | null
): Promise<PracticeCaseRow[]> {
  // Ordered by id so the candidate list is a stable sequence — without it the
  // index the hash produces would point at a different row run to run.
  const query = supabase
    .from("practice_cases")
    .select("id, raw_input, industry, difficulty")
    .eq("active", true)
    .eq("review_status", "approved")
    .order("id", { ascending: true });

  const { data, error } = await (difficulty === null
    ? query
    : query.eq("difficulty", difficulty));
  if (error) throw new Error(error.message);
  return (data ?? []).filter((row) => (row as PracticeCaseRow & { flagged?: boolean }).flagged !== true) as PracticeCaseRow[];
}

/**
 * Guess and reveal happen on one screen for daily practice, so this is a single
 * combined write instead of Task 6's `saveGuess` followed by Task 7's
 * `runRevealStep`. It reuses the exact same shared engine, `recommendCategory`
 * — no second prompt, no duplicated Groq-call logic.
 *
 * The `solves` row is created HERE, at the first (and only) write, rather than
 * on page render. Creating it on render meant every reload of /practice/today
 * left behind an orphan draft that history rendered as "In progress" and the
 * progress trend counted in its week buckets. Deferring creation to the point of
 * an actual guess means a visit that never gets answered leaves nothing behind,
 * and the guess and its reveal land atomically in one insert.
 *
 * It takes a `practiceCaseId`, not the case text: a server action is a public
 * endpoint, so the scenario the model is asked about is re-read from the curated
 * `practice_cases` table rather than accepted from the caller.
 *
 * Practice cases are curated content (Task 2's `practice_cases`, seeded/admin,
 * never messy user input), so unlike the live flow there is no separate
 * structuring step here: the case's `raw_input` is passed straight through as
 * both the "goal" and "problem type" context the reveal engine expects. That
 * is a deliberate skip of Task 5's `structureProblem`, per this task's
 * constraint that no new Groq call is introduced beyond Task 7's.
 */
export async function submitPracticeGuess(
  practiceCaseId: string,
  guessedCategory: string
): Promise<RevealResult & { solveId: string }> {
  // A server action is a public endpoint: the guess must be one of the fixed
  // categories, because the reveal engine compares against that same list.
  if (!isCategory(guessedCategory)) {
    throw new Error(`Unknown category: ${guessedCategory}`);
  }

  const { supabase, user } = await getVerifiedUser();
  const userId = user?.id;
  if (!userId) throw new Error("Not authenticated");

  const { data: practiceCase, error: fetchErr } = await supabase
    .from("practice_cases")
    .select("raw_input, industry")
    .eq("id", practiceCaseId)
    .single();
  if (fetchErr) throw new Error(fetchErr.message);

  const result = await recommendCategory({
    goal: practiceCase.raw_input,
    problemType: practiceCase.raw_input,
    guessedCategory,
  });

  const { data: inserted, error: insertErr } = await supabase
    .from("solves")
    .insert({
      user_id: userId,
      source: "practice",
      raw_input: practiceCase.raw_input,
      industry: practiceCase.industry ?? null,
      guessed_category: guessedCategory,
      revealed_category: result.revealedCategory,
      tool_class: result.toolClass,
      correct: result.match,
      why_it_fits: result.whyItFits,
      why_not_alternatives: result.whyNotAlternatives,
    })
    .select("id")
    .single();
  if (insertErr) throw new Error(insertErr.message);

  track("guess_locked", userId, { source: "practice", guessedCategory, correct: result.match });
  // Canonical "did real practice" signal, distinct from the specific funnel
  // events — see Solution Overview.md's active/inactive user definitions.
  track("meaningful_activity_completed", userId, { source: "daily_challenge" });
  return { ...result, solveId: inserted.id as string };
}
