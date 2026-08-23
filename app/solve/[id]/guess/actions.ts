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

  const { error } = await supabase
    .from("solves")
    .update({ guessed_category: guessedCategory })
    .eq("id", solveId);
  if (error) throw new Error(error.message);
}
