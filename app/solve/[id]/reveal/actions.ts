"use server";
import { getVerifiedUser } from "@/lib/supabase/server";
import { recommendCategory, type RevealResult } from "@/lib/engine/reveal";
import { generateSolution } from "@/lib/engine/solution";

export async function runRevealStep(
  solveId: string
): Promise<RevealResult & { solution: string }> {
  const { supabase, user } = await getVerifiedUser();
  if (!user?.id) throw new Error("Not authenticated");

  const { data: solve, error: fetchErr } = await supabase
    .from("solves")
    .select("raw_input, goal, problem_type, guessed_category")
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

  // Independent of each other — one teaches the AI-approach category
  // (recommendCategory, never names a product), the other directly answers
  // the consultant's actual question (generateSolution, may name products
  // freely). Run together since both are needed for this one screen.
  const [result, solution] = await Promise.all([
    recommendCategory({
      goal: solve.goal,
      problemType: solve.problem_type,
      guessedCategory: solve.guessed_category,
    }),
    generateSolution(solve.raw_input),
  ]);

  const { error: updateErr } = await supabase
    .from("solves")
    .update({
      revealed_category: result.revealedCategory,
      tool_class: result.toolClass,
      correct: result.match,
      // Persisted so a reload re-renders the comparison instead of re-running the
      // model. supabase-js serialises the array straight into the jsonb column.
      why_it_fits: result.whyItFits,
      why_not_alternatives: result.whyNotAlternatives,
      solution,
    })
    .eq("id", solveId);
  if (updateErr) throw new Error(updateErr.message);

  return { ...result, solution };
}
