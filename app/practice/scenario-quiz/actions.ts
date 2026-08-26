"use server";

import { getVerifiedUser } from "@/lib/supabase/server";

export type ScenarioQuizQuestion = {
  id: string;
  difficulty: "easy" | "medium" | "hard";
  questionText: string;
  options: string[];
  answer: string;
  explanation: string;
};

export async function getScenarioQuizQuestions(difficulty: ScenarioQuizQuestion["difficulty"]): Promise<ScenarioQuizQuestion[]> {
  const { supabase, user } = await getVerifiedUser();
  if (!user?.id) throw new Error("Not authenticated");
  // A scenario must never repeat for a user once it's appeared — exclude
  // every scenario this user has already attempted.
  const { data: attempted, error: attemptedError } = await supabase
    .from("scenario_quiz_attempts")
    .select("question_id")
    .eq("user_id", user.id);
  if (attemptedError) throw new Error(attemptedError.message);
  const seenIds = [...new Set((attempted ?? []).map((row) => row.question_id as string))];
  let query = supabase
    .from("scenario_quiz_questions")
    .select("id, difficulty, question_text, options, answer, explanation")
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
    options: Array.isArray(row.options) ? row.options.map(String) : [],
    answer: String(row.answer),
    explanation: String(row.explanation),
  }));
}

export async function recordScenarioQuizAttempt(input: { questionId: string; selectedAnswer: string; seconds: number | null }) {
  const { supabase, user } = await getVerifiedUser();
  if (!user?.id) throw new Error("Not authenticated");
  const { data: question, error: questionError } = await supabase
    .from("scenario_quiz_questions")
    .select("answer")
    .eq("id", input.questionId)
    .single();
  if (questionError) throw new Error(questionError.message);
  const correct = question.answer === input.selectedAnswer;
  const { error } = await supabase.from("scenario_quiz_attempts").insert({
    user_id: user.id,
    question_id: input.questionId,
    selected_answer: input.selectedAnswer,
    correct,
    seconds: input.seconds,
  });
  if (error) throw new Error(error.message);
  return { correct };
}
