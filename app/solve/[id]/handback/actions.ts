"use server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { generateHandback } from "@/lib/engine/handback";

/**
 * The Handback artifact is generated on demand from the summary screen — it
 * is never triggered automatically. A server action is a public endpoint, so
 * both the auth check and the reveal-before-handback prerequisite are
 * enforced here, not only by the page's routing.
 */
export async function createHandback(solveId: string): Promise<string> {
  const supabase = await getSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user?.id) throw new Error("Not authenticated");

  const { data: solve, error: fetchErr } = await supabase
    .from("solves")
    .select("goal, problem_type, revealed_category")
    .eq("id", solveId)
    .single();
  if (fetchErr) throw new Error(fetchErr.message);

  if (!solve.revealed_category) {
    throw new Error("This solve hasn't been revealed yet");
  }

  const draftText = await generateHandback({
    goal: solve.goal,
    problemType: solve.problem_type,
    revealedCategory: solve.revealed_category,
  });

  const { error: insertErr } = await supabase
    .from("takeaways")
    .insert({ solve_id: solveId, draft_text: draftText });
  if (insertErr) throw new Error(insertErr.message);

  return draftText;
}
