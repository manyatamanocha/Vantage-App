"use server";
import { getVerifiedUser } from "@/lib/supabase/server";
import { generateSolution, type SolutionResult } from "@/lib/engine/solution";
import { track } from "@/lib/analytics/track";

export async function runSolutionStep(solveId: string): Promise<SolutionResult> {
  const { supabase, user } = await getVerifiedUser();
  if (!user?.id) throw new Error("Not authenticated");

  const { data: solve, error: fetchErr } = await supabase
    .from("solves")
    .select("raw_input, goal")
    .eq("id", solveId)
    .single();
  if (fetchErr) throw new Error(fetchErr.message);
  if (!solve.raw_input) throw new Error("This solve has no problem statement yet");

  // Prefer the Groq-refined goal from the confirm step (typos/grammar fixed,
  // vague phrasing tightened) over the raw typed/dictated input — falls back
  // to raw_input for solves that skipped that step (e.g. practice-sourced).
  const solution = await generateSolution(solve.goal || solve.raw_input);

  const { error: updateErr } = await supabase
    .from("solves")
    .update({ solution })
    .eq("id", solveId);
  if (updateErr) throw new Error(updateErr.message);

  track("solution_generated", user.id, { solveId });
  // Canonical "did real practice" signal, distinct from the specific funnel
  // events — see Solution Overview.md's active/inactive user definitions.
  track("meaningful_activity_completed", user.id, { source: "solve" });
  return solution;
}
