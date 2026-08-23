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
