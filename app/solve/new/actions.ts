"use server";
import { getVerifiedUser } from "@/lib/supabase/server";
import { structureProblem } from "@/lib/engine/structure";

export async function createDraftSolve(input: {
  rawInput: string;
  industry?: string;
  source: "live" | "practice";
  goal?: string;
  problemType?: string;
}): Promise<{ solveId: string }> {
  if (!input.rawInput.trim()) throw new Error("Raw input is required");

  const { supabase, user } = await getVerifiedUser();
  const userId = user?.id;
  if (!userId) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("solves")
    .insert({
      user_id: userId,
      source: input.source,
      raw_input: input.rawInput,
      industry: input.industry ?? null,
      goal: input.goal ?? null,
      problem_type: input.problemType ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return { solveId: data.id };
}

// Runs the LLM refinement without persisting anything yet — used by the
// intake screen's inline "Is that what you mean?" confirmation step, before
// the user has actually committed to solving this problem. Nothing is
// written to the database until createDraftSolve, which happens only once
// they confirm.
export async function refineAsk(rawInput: string): Promise<{ goal: string; problemType: string }> {
  if (!rawInput.trim()) throw new Error("Raw input is required");
  const { user } = await getVerifiedUser();
  if (!user?.id) throw new Error("Not authenticated");
  return structureProblem(rawInput);
}
