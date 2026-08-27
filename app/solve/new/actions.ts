"use server";
import { z } from "zod";
import { getVerifiedUser } from "@/lib/supabase/server";
import { structureProblem, AskRefusedError } from "@/lib/engine/structure";
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
  // `source` in analytics means the SURFACE (solve / daily_challenge /
  // quiz_general / quiz_scenario) — it is what surfaceBreakdown groups on and
  // what the completion event fires with. `solves.source` is a different,
  // domain-level thing ("live" client problem vs. "practice" case), so passing
  // it through as `source` split Solve across two phantom surfaces. Keep the
  // domain value, under its own key.
  track("solve_started", userId, { source: "solve", origin: parsed.source });
  return { solveId: data.id };
}

const rawInputSchema = z.string().trim().min(1, "Raw input is required");

// Runs the LLM refinement without persisting anything yet — used by the
// intake screen's inline "Is that what you mean?" confirmation step, before
// the user has actually committed to solving this problem. Nothing is
// written to the database until createDraftSolve, which happens only once
// they confirm.
export type RefineAskResult =
  | { refused: false; goal: string; problemType: string }
  | { refused: true; message: string };

export async function refineAsk(rawInput: string): Promise<RefineAskResult> {
  const parseResult = rawInputSchema.safeParse(rawInput);
  if (!parseResult.success) throw new Error(parseResult.error.issues[0].message);
  const { user } = await getVerifiedUser();
  if (!user?.id) throw new Error("Not authenticated");
  // Fires when someone actually submits an ask — the step BEFORE they commit
  // via "Let's solve" (solve_started). Without both, the intake screen's
  // drop-off between "typed something" and "went ahead with it" is invisible.
  track("ask_submitted", user.id, { length: parseResult.data.length });

  try {
    const { goal, problemType } = await structureProblem(parseResult.data);
    return { refused: false, goal, problemType };
  } catch (err) {
    // A declined ask is a normal outcome, not a failure: return it so the
    // intake screen can say so plainly. Throwing would be useless here —
    // Next.js redacts server-action errors in production, so the browser
    // would see a generic message and could not tell a refusal from a crash.
    // Everything else still throws, so real breakage stays visible.
    if (!(err instanceof AskRefusedError)) throw err;
    track("ask_refused", user.id, { length: parseResult.data.length });
    return { refused: true, message: err.message };
  }
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
