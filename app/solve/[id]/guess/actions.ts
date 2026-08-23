"use server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { isCategory } from "@/lib/engine/taxonomy";

export async function saveGuess(
  solveId: string,
  guessedCategory: string
): Promise<void> {
  // A server action is a public endpoint: the guess must be one of the fixed
  // categories, because Task 7's reveal compares against that same list.
  if (!isCategory(guessedCategory)) {
    throw new Error(`Unknown category: ${guessedCategory}`);
  }

  const supabase = await getSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user?.id) throw new Error("Not authenticated");

  // The guess-before-reveal mechanic is the product. Once `revealed_category`
  // is set the answer is on screen, so a later write to `guessed_category`
  // could only rewrite history — the browser Back button plus a second lock-in
  // was enough to do it. `correct` is derived at reveal time and is not
  // recomputed here, so an accepted late guess left the row self-contradictory:
  // "You had it" next to a guess that doesn't match the revealed category.
  //
  // `.is("revealed_category", null)` makes the update conditional in the
  // database rather than in a read-then-write that could race. `.select("id")`
  // is what makes the outcome observable: without it a filtered-out update is
  // reported as a plain success.
  const { data: updated, error } = await supabase
    .from("solves")
    .update({ guessed_category: guessedCategory })
    .eq("id", solveId)
    .is("revealed_category", null)
    .select("id");
  if (error) throw new Error(error.message);

  if (!updated || updated.length === 0) {
    // Also the shape of a solve that isn't this user's (RLS filters it out) or
    // doesn't exist — all three mean the same thing to the caller: this guess
    // was not recorded.
    throw new Error(
      "This guess wasn't saved: the solve has already been revealed, or it isn't available to you."
    );
  }
}
