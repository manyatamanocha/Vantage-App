"use server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function getSettings(
  userId: string
): Promise<{ practiceDifficulty?: string; practiceFrequency?: string }> {
  const supabase = await getSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user?.id) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("user_settings")
    .select("practice_difficulty, practice_frequency")
    .eq("user_id", userId)
    .single();

  if (error) throw new Error(error.message);

  return {
    practiceDifficulty: data?.practice_difficulty,
    practiceFrequency: data?.practice_frequency,
  };
}

export async function updateSettings(
  userId: string,
  patch: { practiceDifficulty?: string; practiceFrequency?: string }
): Promise<void> {
  const supabase = await getSupabaseServerClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user?.id) throw new Error("Not authenticated");

  const dbPatch: Record<string, string> = {};
  if (patch.practiceDifficulty) dbPatch.practice_difficulty = patch.practiceDifficulty;
  if (patch.practiceFrequency) dbPatch.practice_frequency = patch.practiceFrequency;
  const { error } = await supabase.from("user_settings").update(dbPatch).eq("user_id", userId);
  if (error) throw new Error(error.message);
}
