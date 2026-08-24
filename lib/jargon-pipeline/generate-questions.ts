import { getGroqClient } from "@/lib/groq";
import { checkFinishReason } from "@/lib/engine/check-finish-reason";
import { parseJsonResponse } from "@/lib/engine/parse-json-response";
import { withRetry } from "@/lib/engine/with-retry";

export type QuizDifficulty = "easy" | "medium" | "hard";
export type JargonQuestionCandidate = {
  difficulty: QuizDifficulty;
  term: string;
  questionText: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
};

const prompt = `Return JSON only. Create 120 jargon-definition multiple-choice questions for a client-facing consultant learning AI vocabulary. Split them evenly across easy, medium, and hard. Each item must have difficulty, term, questionText, exactly four distinct options, correctAnswer copied exactly from options, and a plain-language fifth-grade-level explanation. Do not name commercial products, vendors, or models. Shape: {"questions":[{"difficulty":"easy|medium|hard","term":"...","questionText":"...","options":["...","...","...","..."],"correctAnswer":"...","explanation":"..."}]}`;

type Raw = { questions: JargonQuestionCandidate[] };
function isRaw(value: unknown): value is Raw {
  return typeof value === "object" && value !== null && Array.isArray((value as Raw).questions);
}

export async function generateJargonQuestions(): Promise<JargonQuestionCandidate[]> {
  const response = await withRetry((signal) => getGroqClient().chat.completions.create({
    model: "openai/gpt-oss-120b",
    reasoning_effort: "low",
    max_tokens: 12000,
    response_format: { type: "json_object" },
    messages: [{ role: "system", content: prompt }],
  }, { maxRetries: 0, signal }));
  checkFinishReason(response.choices[0]?.finish_reason, "generate-jargon-questions");
  const parsed = parseJsonResponse(response.choices[0]?.message?.content ?? "", isRaw, "generate-jargon-questions");
  return parsed.questions;
}
