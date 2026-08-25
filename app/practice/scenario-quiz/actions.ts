"use server";

import { getVerifiedUser } from "@/lib/supabase/server";

export type ScenarioQuizQuestion = {
  id: string;
  difficulty: "easy" | "medium" | "hard";
  questionText: string;
  answer: string;
  explanation: string;
};

export async function getScenarioQuizQuestions(difficulty: ScenarioQuizQuestion["difficulty"]): Promise<ScenarioQuizQuestion[]> {
  const { supabase, user } = await getVerifiedUser();
  if (!user?.id) throw new Error("Not authenticated");
  // A scenario must never repeat for a user once it's appeared — exclude
  // every scenario this user has already had revealed.
  const { data: attempted, error: attemptedError } = await supabase
    .from("scenario_quiz_attempts")
    .select("question_id")
    .eq("user_id", user.id);
  if (attemptedError) throw new Error(attemptedError.message);
  const seenIds = [...new Set((attempted ?? []).map((row) => row.question_id as string))];
  let query = supabase
    .from("scenario_quiz_questions")
    .select("id, difficulty, question_text, answer, explanation")
    .eq("difficulty", difficulty)
    .eq("flagged", false)
    .order("created_at", { ascending: true });
  if (seenIds.length > 0) query = query.not("id", "in", `(${seenIds.join(",")})`);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: String(row.id),
    difficulty: row.difficulty as ScenarioQuizQuestion["difficulty"],
    questionText: String(row.question_text),
    answer: String(row.answer),
    explanation: String(row.explanation),
  }));
}

export async function recordScenarioQuizAttempt(input: { questionId: string; seconds: number | null }) {
  const { supabase, user } = await getVerifiedUser();
  if (!user?.id) throw new Error("Not authenticated");
  const { error } = await supabase.from("scenario_quiz_attempts").insert({
    user_id: user.id,
    question_id: input.questionId,
    seconds: input.seconds,
  });
  if (error) throw new Error(error.message);
}
