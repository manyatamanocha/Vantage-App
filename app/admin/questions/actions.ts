"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

export type QuestionTable = "general_quiz_questions" | "scenario_quiz_questions";

export async function listQuestions(table: QuestionTable) {
  await requireAdmin();
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from(table)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return data ?? [];
}

// Shared by create and update: both write the same four fields, differing
// only in the correct-answer column name (general uses `correct_answer`,
// scenario uses `answer`) and in insert vs. update.
function buildQuestionPatch(table: QuestionTable, formData: FormData) {
  const difficulty = String(formData.get("difficulty") ?? "");
  const questionText = String(formData.get("question_text") ?? "").trim();
  if (!["easy", "medium", "hard"].includes(difficulty) || !questionText) {
    throw new Error("Difficulty and question text are required.");
  }
  const options = [0, 1, 2, 3].map((i) => String(formData.get(`option_${i}`) ?? "").trim());
  const answerField = table === "general_quiz_questions" ? "correct_answer" : "answer";
  const answerValue = String(formData.get(answerField) ?? "").trim();
  if (options.some((o) => !o) || !options.includes(answerValue)) {
    throw new Error(`All four options are required and the ${table === "general_quiz_questions" ? "correct answer" : "answer"} must match one of them.`);
  }
  return {
    difficulty,
    question_text: questionText,
    options,
    [answerField]: answerValue,
    explanation: String(formData.get("explanation") ?? "").trim(),
  };
}

export async function createQuestion(table: QuestionTable, formData: FormData) {
  await requireAdmin();
  const patch = buildQuestionPatch(table, formData);
  // Neither table has a review gate yet (review_status doesn't exist on
  // either) — a question written here through the admin panel goes live
  // immediately, same as `flagged` defaulting to false on insert. When the
  // review-status migration lands, this insert should set it explicitly
  // rather than relying on a column default meant for pipeline-generated
  // content.
  const { error } = await getSupabaseAdminClient().from(table).insert(patch);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/questions");
}

export async function updateQuestion(table: QuestionTable, id: string, formData: FormData) {
  await requireAdmin();
  const patch = buildQuestionPatch(table, formData);
  const { error } = await getSupabaseAdminClient().from(table).update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/questions");
}

export async function deleteQuestion(table: QuestionTable, id: string) {
  await requireAdmin();
  const { error } = await getSupabaseAdminClient().from(table).delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/questions");
}
