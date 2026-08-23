"use server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { recommendCategory, type RevealResult } from "@/lib/engine/reveal";

export async function runRevealStep(solveId: string): Promise<RevealResult> {
  const supabase = await getSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user?.id) throw new Error("Not authenticated");

  const { data: solve, error: fetchErr } = await supabase
    .from("solves")
    .select("goal, problem_type, guessed_category")
    .eq("id", solveId)
    .single();
  if (fetchErr) throw new Error(fetchErr.message);

  // A server action is a public endpoint, so the guess-before-reveal mechanic is
  // enforced here and not only by the UI's routing: no reveal without a
  // structured problem and a committed guess.
  if (!solve.goal || !solve.problem_type) {
    throw new Error("This solve hasn't been structured yet");
  }
  if (!solve.guessed_category) {
    throw new Error("No guess has been recorded for this solve yet");
  }

  const result = await recommendCategory({
    goal: solve.goal,
    problemType: solve.problem_type,
    guessedCategory: solve.guessed_category,
  });

  const { error: updateErr } = await supabase
    .from("solves")
    .update({
      revealed_category: result.revealedCategory,
      tool_class: result.toolClass,
      correct: result.match,
    })
    .eq("id", solveId);
  if (updateErr) throw new Error(updateErr.message);

  return result;
}
