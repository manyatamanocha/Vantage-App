"use server";
import { getVerifiedUser } from "@/lib/supabase/server";

// Defaults must match the DB column defaults in supabase/migrations/0001_init.sql
// (practice_difficulty default 'medium', practice_frequency default 'daily') and
// 0007_default_question_type.sql (default_question_type default 'scenario'),
// since no row is guaranteed to exist yet for a given user_id.
const DEFAULT_SETTINGS = {
  practiceDifficulty: "medium",
  practiceFrequency: "daily",
  defaultQuestionType: "scenario",
} as const;

export type Settings = {
  practiceDifficulty: string;
  practiceFrequency: string;
  defaultQuestionType: "scenario" | "quiz";
};

export async function getSettings(userId: string): Promise<Settings> {
  const { supabase, user } = await getVerifiedUser();
  if (!user?.id) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("user_settings")
    .select("practice_difficulty, practice_frequency, default_question_type")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  return {
    practiceDifficulty: data?.practice_difficulty ?? DEFAULT_SETTINGS.practiceDifficulty,
    practiceFrequency: data?.practice_frequency ?? DEFAULT_SETTINGS.practiceFrequency,
    defaultQuestionType:
      (data?.default_question_type as Settings["defaultQuestionType"] | undefined) ??
      DEFAULT_SETTINGS.defaultQuestionType,
  };
}

export async function updateSettings(
  userId: string,
  patch: { practiceDifficulty?: string; practiceFrequency?: string; defaultQuestionType?: string }
): Promise<void> {
  const { supabase, user } = await getVerifiedUser();
  if (!user?.id) throw new Error("Not authenticated");

  // Upsert (rather than update) because no row is guaranteed to exist for this
  // user yet (nothing creates a user_settings row at signup). Only the patched
  // fields plus the conflict key (user_id) are sent, so: on first insert the DB
  // column defaults fill in any field not being set, and on conflict only the
  // provided columns are overwritten, preserving partial-patch semantics.
  const dbPatch: Record<string, string> = { user_id: userId };
  if (patch.practiceDifficulty) dbPatch.practice_difficulty = patch.practiceDifficulty;
  if (patch.practiceFrequency) dbPatch.practice_frequency = patch.practiceFrequency;
  if (patch.defaultQuestionType) dbPatch.default_question_type = patch.defaultQuestionType;
  const { error } = await supabase.from("user_settings").upsert(dbPatch);
  if (error) throw new Error(error.message);
}
