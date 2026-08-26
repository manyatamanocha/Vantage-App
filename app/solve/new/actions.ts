"use server";
import { z } from "zod";
import { getVerifiedUser } from "@/lib/supabase/server";
import { structureProblem } from "@/lib/engine/structure";
import { checkGrammar, type GrammarCheckResult } from "@/lib/engine/grammar";
import { track } from "@/lib/analytics/track";

const createDraftSolveSchema = z.object({
  rawInput: z.string().trim().min(1, "Raw input is required"),
  industry: z.string().trim().optional(),
  source: z.enum(["live", "practice"]),
  goal: z.string().trim().optional(),
  problemType: z.string().trim().optional(),
});

export async function createDraftSolve(input: {
  rawInput: string;
  industry?: string;
  source: "live" | "practice";
  goal?: string;
  problemType?: string;
}): Promise<{ solveId: string }> {
  const parseResult = createDraftSolveSchema.safeParse(input);
  if (!parseResult.success) throw new Error(parseResult.error.issues[0].message);
  const parsed = parseResult.data;

  const { supabase, user } = await getVerifiedUser();
  const userId = user?.id;
  if (!userId) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("solves")
    .insert({
      user_id: userId,
      source: parsed.source,
      raw_input: parsed.rawInput,
      industry: parsed.industry ?? null,
      goal: parsed.goal ?? null,
      problem_type: parsed.problemType ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  track("solve_started", userId, { source: parsed.source });
  return { solveId: data.id };
}

const rawInputSchema = z.string().trim().min(1, "Raw input is required");

// Runs the LLM refinement without persisting anything yet — used by the
// intake screen's inline "Is that what you mean?" confirmation step, before
// the user has actually committed to solving this problem. Nothing is
// written to the database until createDraftSolve, which happens only once
// they confirm.
export async function refineAsk(rawInput: string): Promise<{ goal: string; problemType: string }> {
  const parseResult = rawInputSchema.safeParse(rawInput);
  if (!parseResult.success) throw new Error(parseResult.error.issues[0].message);
  const { user } = await getVerifiedUser();
  if (!user?.id) throw new Error("Not authenticated");
  return structureProblem(parseResult.data);
}

// Live grammar/spelling check for the intake textarea — debounced on the
// client, called on pauses in typing rather than every keystroke. Separate
// from refineAsk: this only fixes wording as you type, it does not extract
// goal/problemType (that still happens once, on Submit).
export async function checkAskGrammar(rawInput: string): Promise<GrammarCheckResult> {
  const parseResult = rawInputSchema.safeParse(rawInput);
  if (!parseResult.success) throw new Error(parseResult.error.issues[0].message);
  const { user } = await getVerifiedUser();
  if (!user?.id) throw new Error("Not authenticated");
  return checkGrammar(parseResult.data);
}
