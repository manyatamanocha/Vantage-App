"use server";

import { z } from "zod";
import { getVerifiedUser } from "@/lib/supabase/server";
import { track } from "@/lib/analytics/track";

const ratingSchema = z.number().int().min(1, "Rating must be from 1 to 5").max(5, "Rating must be from 1 to 5");

export type JargonQuestion = {
  id: string;
  poolDate: string;
  difficulty: "easy" | "medium" | "hard";
  term: string;
  questionText: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
};

export async function getJargonQuestions(difficulty: JargonQuestion["difficulty"]): Promise<JargonQuestion[]> {
  const { supabase, user } = await getVerifiedUser();
  if (!user?.id) throw new Error("Not authenticated");
  const { data, error } = await supabase
    .from("daily_quiz_questions")
    .select("id, pool_date, difficulty, term, question_text, options, correct_answer, explanation")
    .eq("difficulty", difficulty)
    .eq("flagged", false)
    .eq("review_status", "approved")
    .order("pool_date", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const latestDate = rows[0]?.pool_date;
  return rows
    .filter((row) => row.pool_date === latestDate)
    .map((row) => ({
      id: String(row.id), poolDate: String(row.pool_date), difficulty: row.difficulty as JargonQuestion["difficulty"],
      term: String(row.term), questionText: String(row.question_text), options: Array.isArray(row.options) ? row.options.map(String) : [],
      correctAnswer: String(row.correct_answer), explanation: String(row.explanation),
    }));
}

export async function recordJargonAttempt(input: { questionId: string; selectedAnswer: string; seconds: number | null; }) {
  const { supabase, user } = await getVerifiedUser();
  if (!user?.id) throw new Error("Not authenticated");
  // Compared against `term`, not `correct_answer` — the quiz now asks
  // "Which term means: [definition]?" with term names as the answer
  // options, so the selected answer the client submits is a term.
  const { data: question, error: questionError } = await supabase.from("daily_quiz_questions").select("term").eq("id", input.questionId).single();
  if (questionError) throw new Error(questionError.message);
  const correct = question.term === input.selectedAnswer;
  const { data: attempt, error } = await supabase.from("jargon_attempts").insert({
    user_id: user.id, question_id: input.questionId, selected_answer: input.selectedAnswer,
    correct, seconds: input.seconds, helpful_rating: null,
  }).select("id").single();
  if (error) throw new Error(error.message);
  track("quiz_attempt", user.id, { correct });
  return { correct, attemptId: attempt?.id as string | undefined };
}

export async function rateJargonAttempt(attemptId: string, rating: number) {
  const parseResult = ratingSchema.safeParse(rating);
  if (!parseResult.success) throw new Error(parseResult.error.issues[0].message);
  const { supabase, user } = await getVerifiedUser();
  if (!user?.id) throw new Error("Not authenticated");
  const { error } = await supabase.from("jargon_attempts").update({ helpful_rating: rating }).eq("id", attemptId).eq("user_id", user.id);
  if (error) throw new Error(error.message);
}
