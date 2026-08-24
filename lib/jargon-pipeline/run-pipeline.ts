import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { dedupeQuestions } from "./dedupe";
import { generateJargonQuestions } from "./generate-questions";
import { validateQuestion } from "./validate-question";

export async function runJargonPipeline() {
  const supabase = getSupabaseAdminClient();
  const generated = await generateJargonQuestions();
  const { data: existing, error: fetchError } = await supabase.from("daily_quiz_questions").select("term, question_text").eq("flagged", false);
  if (fetchError) throw new Error(fetchError.message);
  const existingKeys = (existing ?? []).map((row) => `${row.term} ${row.question_text}`);
  const deduped = dedupeQuestions(generated, existingKeys);
  const rejectedDuplicate = generated.length - deduped.length;
  const valid = deduped.filter((candidate) => {
    const result = validateQuestion(candidate);
    if (!result.valid) console.warn(`[jargon-pipeline] rejected: ${result.reason}`);
    return result.valid;
  });
  const rejectedValidation = deduped.length - valid.length;
  if (valid.length) {
    const { error } = await supabase.from("daily_quiz_questions").insert(valid.map((question) => ({
      difficulty: question.difficulty, term: question.term, question_text: question.questionText,
      options: question.options, correct_answer: question.correctAnswer, explanation: question.explanation,
    })));
    if (error) throw new Error(error.message);
  }
  return { generated: generated.length, rejectedDuplicate, rejectedValidation, inserted: valid.length };
}
