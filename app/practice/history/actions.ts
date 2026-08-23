"use server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type SolveHistoryRow = {
  id: string;
  source: "live" | "practice";
  revealedCategory: string;
  correct: boolean;
  createdAt: string;
};

export async function listSolves(userId: string): Promise<SolveHistoryRow[]> {
  const supabase = await getSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user?.id) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("solves")
    .select("id, source, revealed_category, correct, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data.map((row) => ({
    id: row.id as string,
    source: row.source as "live" | "practice",
    revealedCategory: row.revealed_category as string,
    correct: row.correct as boolean,
    createdAt: row.created_at as string,
  }));
}
