import { assertNoNamedProducts } from "@/lib/engine/guardrails";
import type { JargonQuestionCandidate } from "./generate-questions";

export function validateQuestion(candidate: JargonQuestionCandidate): { valid: true } | { valid: false; reason: string } {
  if (!["easy", "medium", "hard"].includes(candidate.difficulty)) return { valid: false, reason: "invalid difficulty" };
  if (!candidate.term.trim() || !candidate.questionText.trim() || !candidate.explanation.trim()) return { valid: false, reason: "missing text" };
  if (candidate.options.length !== 4 || new Set(candidate.options.map((option) => option.trim().toLowerCase())).size !== 4) return { valid: false, reason: "options must contain four distinct values" };
  if (!candidate.options.includes(candidate.correctAnswer)) return { valid: false, reason: "correct answer is not an option" };
  try {
    assertNoNamedProducts(`${candidate.questionText}\n${candidate.options.join("\n")}\n${candidate.explanation}`, "jargon question");
  } catch (error) {
    return { valid: false, reason: error instanceof Error ? error.message : "named product" };
  }
  return { valid: true };
}
