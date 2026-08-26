"use server";
import { getVerifiedUser } from "@/lib/supabase/server";

export async function getProgressStats(userId: string): Promise<{
  firstGuessAccuracy: number;
  byCategory: Record<string, number>;
  completedCount: number;
}> {
  const { supabase, user } = await getVerifiedUser();
  if (!user?.id) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("solves")
    .select("revealed_category, correct")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);

  // Filter out abandoned solves (where correct is null)
  const rows = (data as { revealed_category: string | null; correct: boolean | null }[]).filter(
    (r): r is { revealed_category: string; correct: boolean } => r.correct !== null
  );

  const firstGuessAccuracy = rows.length ? rows.filter((r) => r.correct).length / rows.length : 0;

  const byCategory: Record<string, number> = {};
  const grouped = new Map<string, boolean[]>();
  for (const row of rows) {
    const list = grouped.get(row.revealed_category) ?? [];
    list.push(row.correct);
    grouped.set(row.revealed_category, list);
  }
  for (const [category, results] of grouped) {
    byCategory[category] = results.filter(Boolean).length / results.length;
  }

  return { firstGuessAccuracy, byCategory, completedCount: rows.length };
}

export async function getQuizStats(userId: string): Promise<{
  accuracy: number;
  attemptCount: number;
}> {
  const { supabase, user } = await getVerifiedUser();
  if (!user?.id) throw new Error("Not authenticated");

  // Quiz-taking now happens through Quiz Time and Scenario Quiz (the
  // practice-nav restructure dropped the old Term Quiz), so those two
  // tables are the real source of attempts — jargon_attempts stays empty.
  const [general, scenario] = await Promise.all([
    supabase.from("general_quiz_attempts").select("correct").eq("user_id", userId),
    supabase.from("scenario_quiz_attempts").select("correct").eq("user_id", userId),
  ]);
  if (general.error) throw new Error(general.error.message);
  if (scenario.error) throw new Error(scenario.error.message);

  // A handful of scenario attempts predate the migration that added
  // `correct` (0013_scenario_quiz_mcq.sql) and are null — not gradeable.
  const rows = [...general.data, ...scenario.data].filter(
    (r): r is { correct: boolean } => r.correct !== null
  );
  const accuracy = rows.length ? rows.filter((r) => r.correct).length / rows.length : 0;

  return { accuracy, attemptCount: rows.length };
}

export type ProgressSolveRow = {
  createdAt: string;
  correct: boolean | null;
};

export async function getProgressSolves(userId: string): Promise<ProgressSolveRow[]> {
  const { supabase, user } = await getVerifiedUser();
  if (!user?.id) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("solves")
    .select("created_at, correct")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  return (data as { created_at: string; correct: boolean | null }[]).map((row) => ({
    createdAt: row.created_at,
    correct: row.correct,
  }));
}
