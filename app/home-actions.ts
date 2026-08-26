"use server";
import { getVerifiedUser } from "@/lib/supabase/server";

export type ContinueSolve = {
  id: string;
  title: string;
  createdAt: string;
};

// Most recent live client problem the user started but hasn't reached the
// reveal for yet (correct is only ever set once reveal runs) — Home's
// "Continue where you left off" resumes exactly this one. Practice-source
// rows are excluded: their resume path is "today's practice", not a specific
// case, so surfacing them here would point at the wrong screen.
export async function getLatestUnfinishedSolve(userId: string): Promise<ContinueSolve | null> {
  const { supabase, user } = await getVerifiedUser();
  if (!user?.id) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("solves")
    .select("id, goal, raw_input, created_at")
    .eq("user_id", userId)
    .eq("source", "live")
    .is("correct", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const goal = data.goal as string | null;
  const rawInput = data.raw_input as string;
  const title = goal || (rawInput.length > 72 ? `${rawInput.slice(0, 72)}…` : rawInput);

  return { id: data.id as string, title, createdAt: data.created_at as string };
}
