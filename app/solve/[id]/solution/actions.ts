"use server";
import { getVerifiedUser } from "@/lib/supabase/server";
import { generateSolution, type SolutionResult } from "@/lib/engine/solution";

export async function runSolutionStep(solveId: string): Promise<SolutionResult> {
  const { supabase, user } = await getVerifiedUser();
  if (!user?.id) throw new Error("Not authenticated");

  const { data: solve, error: fetchErr } = await supabase
    .from("solves")
    .select("raw_input")
    .eq("id", solveId)
    .single();
  if (fetchErr) throw new Error(fetchErr.message);
  if (!solve.raw_input) throw new Error("This solve has no problem statement yet");

  const solution = await generateSolution(solve.raw_input);

  const { error: updateErr } = await supabase
    .from("solves")
    .update({ solution })
    .eq("id", solveId);
  if (updateErr) throw new Error(updateErr.message);

  return solution;
}
