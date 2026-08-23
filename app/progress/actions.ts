"use server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function getProgressStats(userId: string): Promise<{
  firstGuessAccuracy: number;
  byCategory: Record<string, number>;
}> {
  const supabase = await getSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user?.id) throw new Error("Not authenticated");

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

  return { firstGuessAccuracy, byCategory };
}

export type ProgressSolveRow = {
  createdAt: string;
  correct: boolean | null;
};

export async function getProgressSolves(userId: string): Promise<ProgressSolveRow[]> {
  const supabase = await getSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user?.id) throw new Error("Not authenticated");

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
