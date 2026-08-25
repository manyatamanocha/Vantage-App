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

// Term selection is deliberately narrow: this consultant needs the vocabulary
// that shows up when translating a client ask into an AI-approach category
// and discussing it with a client/team afterward — not ML-engineering
// internals (backpropagation, gradient descent, regularization, embeddings as
// a training mechanic) that a non-technical, client-facing professional would
// never need or be asked about. See PRODUCT.md's persona/taxonomy.
const prompt = `Return JSON only. Create 24 jargon-definition multiple-choice questions for a non-technical, client-facing consultant (not an ML engineer or data scientist). Every term must be one she would realistically hear or need to use when discussing an AI approach with a client or her own team — for example: the AI-approach categories themselves (Classification, RAG / retrieval-augmented generation, Prediction, Summarization, Generation, Extraction, Recommendation, Anomaly Detection), the general-purpose-vs-specialized tool-class distinction, and everyday applied-AI vocabulary a client-facing professional actually encounters (e.g. hallucination, prompt, chatbot, dashboard, automation, data privacy, model, training data, bias, accuracy).

Do NOT use ML-engineering/data-science internals a client-facing consultant would never need — no backpropagation, gradient descent, regularization, cross-validation, embeddings-as-a-training-mechanic, loss function, hyperparameter, neural network architecture terms, or similar.

Split questions evenly across easy, medium, and hard. Each item must have difficulty, term, questionText, exactly four distinct options, correctAnswer copied exactly from options, and a plain-language fifth-grade-level explanation. Do not name commercial products, vendors, or models. Do not repeat a term already covered by another question in this batch. Shape: {"questions":[{"difficulty":"easy|medium|hard","term":"...","questionText":"...","options":["...","...","...","..."],"correctAnswer":"...","explanation":"..."}]}`;

type Raw = { questions: JargonQuestionCandidate[] };
function isRaw(value: unknown): value is Raw {
  return typeof value === "object" && value !== null && Array.isArray((value as Raw).questions);
}

export async function generateJargonQuestions(): Promise<JargonQuestionCandidate[]> {
  const response = await withRetry((signal) => getGroqClient().chat.completions.create({
    model: "openai/gpt-oss-120b",
    reasoning_effort: "low",
    max_tokens: 7500,
    response_format: { type: "json_object" },
    messages: [{ role: "system", content: prompt }],
  }, { maxRetries: 0, signal }));
  checkFinishReason(response.choices[0]?.finish_reason, "generate-jargon-questions");
  const parsed = parseJsonResponse(response.choices[0]?.message?.content ?? "", isRaw, "generate-jargon-questions");
  return parsed.questions;
}
