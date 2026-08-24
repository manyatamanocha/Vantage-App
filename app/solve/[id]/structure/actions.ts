"use server";
import { getVerifiedUser } from "@/lib/supabase/server";
import { structureProblem } from "@/lib/engine/structure";

export async function runStructureStep(
  solveId: string
): Promise<{ goal: string; problemType: string }> {
  const { supabase, user } = await getVerifiedUser();
  if (!user?.id) throw new Error("Not authenticated");

  const { data: solve, error: fetchErr } = await supabase
    .from("solves")
    .select("raw_input, industry")
    .eq("id", solveId)
    .single();
  if (fetchErr) throw new Error(fetchErr.message);

  const { goal, problemType } = await structureProblem(
    solve.raw_input,
    solve.industry ?? undefined
  );

  const { error: updateErr } = await supabase
    .from("solves")
    .update({ goal, problem_type: problemType })
    .eq("id", solveId);
  if (updateErr) throw new Error(updateErr.message);

  return { goal, problemType };
}

export async function editStructure(
  solveId: string,
  goal: string,
  problemType: string
): Promise<void> {
  const { supabase, user } = await getVerifiedUser();
  if (!user?.id) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("solves")
    .update({ goal, problem_type: problemType })
    .eq("id", solveId);
  if (error) throw new Error(error.message);
}
