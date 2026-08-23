"use server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function createDraftSolve(input: {
  rawInput: string;
  industry?: string;
  source: "live" | "practice";
}): Promise<{ solveId: string }> {
  if (!input.rawInput.trim()) throw new Error("Raw input is required");

  const supabase = await getSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("solves")
    .insert({
      user_id: userId,
      source: input.source,
      raw_input: input.rawInput,
      industry: input.industry ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return { solveId: data.id };
}
