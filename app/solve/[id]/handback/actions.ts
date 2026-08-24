"use server";
import { getVerifiedUser } from "@/lib/supabase/server";
import { generateHandback } from "@/lib/engine/handback";

/**
 * The Handback artifact is generated on demand from the summary screen — it
 * is never triggered automatically. A server action is a public endpoint, so
 * both the auth check and the reveal-before-handback prerequisite are
 * enforced here, not only by the page's routing.
 */
export async function createHandback(solveId: string): Promise<string> {
  const { supabase, user } = await getVerifiedUser();
  if (!user?.id) throw new Error("Not authenticated");

  const { data: solve, error: fetchErr } = await supabase
    .from("solves")
    .select("raw_input, goal, problem_type, revealed_category")
    .eq("id", solveId)
    .single();
  if (fetchErr) throw new Error(fetchErr.message);

  if (!solve.revealed_category) {
    throw new Error("This solve hasn't been revealed yet");
  }

  // `goal`/`problem_type` are always NULL on practice-sourced rows: the daily
  // loop skips the structuring step entirely, so nothing ever writes them.
  // Passing those NULLs into the prompt produced "Goal: null" in a
  // *client-facing* artifact — the one output here that leaves the building.
  // Falling back to the row's own `raw_input` is the same substitution
  // `submitPracticeGuess` already makes when it calls the reveal engine, so the
  // handback is written about exactly the problem the reveal reasoned about.
  const goal = solve.goal ?? solve.raw_input;
  const problemType = solve.problem_type ?? solve.raw_input;

  const draftText = await generateHandback({
    goal,
    problemType,
    revealedCategory: solve.revealed_category,
  });

  // Upsert on `solve_id` (unique per supabase/migrations/0003_takeaways_unique_solve.sql)
  // rather than insert: a duplicate invocation (double-click, two open tabs, a
  // repeated POST) must update the existing row instead of erroring on the
  // unique constraint or creating a second row. A re-generation is meant to
  // replace the prior draft, so both `draft_text` and `generated_at` are sent —
  // keeping the stale `generated_at` would misrepresent when the fresh draft
  // was actually produced.
  const { error: upsertErr } = await supabase
    .from("takeaways")
    .upsert(
      { solve_id: solveId, draft_text: draftText, generated_at: new Date().toISOString() },
      { onConflict: "solve_id" }
    );
  if (upsertErr) throw new Error(upsertErr.message);

  return draftText;
}
