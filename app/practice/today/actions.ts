"use server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { recommendCategory, type RevealResult } from "@/lib/engine/reveal";
import { isCategory } from "@/lib/engine/taxonomy";

export async function getTodaysPracticeCase(): Promise<{
  id: string;
  rawInput: string;
  industry?: string;
}> {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from("practice_cases")
    .select("id, raw_input, industry")
    .eq("active", true)
    .limit(1)
    .single();
  if (error) throw new Error(error.message);
  return { id: data.id, rawInput: data.raw_input, industry: data.industry ?? undefined };
}

/**
 * Guess and reveal happen on one screen for daily practice, so this is a single
 * combined write instead of Task 6's `saveGuess` followed by Task 7's
 * `runRevealStep`. It reuses the exact same shared engine, `recommendCategory`
 * — no second prompt, no duplicated Groq-call logic.
 *
 * Practice cases are curated content (Task 2's `practice_cases`, seeded/admin,
 * never messy user input), so unlike the live flow there is no separate
 * structuring step here: the case's `raw_input` is passed straight through as
 * both the "goal" and "problem type" context the reveal engine expects. That
 * is a deliberate skip of Task 5's `structureProblem`, per this task's
 * constraint that no new Groq call is introduced beyond Task 7's.
 */
export async function submitPracticeGuess(
  solveId: string,
  guessedCategory: string
): Promise<RevealResult> {
  // A server action is a public endpoint: the guess must be one of the fixed
  // categories, because the reveal engine compares against that same list.
  if (!isCategory(guessedCategory)) {
    throw new Error(`Unknown category: ${guessedCategory}`);
  }

  const supabase = await getSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user?.id) throw new Error("Not authenticated");

  const { data: solve, error: fetchErr } = await supabase
    .from("solves")
    .select("raw_input, industry")
    .eq("id", solveId)
    .single();
  if (fetchErr) throw new Error(fetchErr.message);

  const result = await recommendCategory({
    goal: solve.raw_input,
    problemType: solve.raw_input,
    guessedCategory,
  });

  const { error: updateErr } = await supabase
    .from("solves")
    .update({
      guessed_category: guessedCategory,
      revealed_category: result.revealedCategory,
      tool_class: result.toolClass,
      correct: result.match,
      why_it_fits: result.whyItFits,
      why_not_alternatives: result.whyNotAlternatives,
    })
    .eq("id", solveId);
  if (updateErr) throw new Error(updateErr.message);

  return result;
}
