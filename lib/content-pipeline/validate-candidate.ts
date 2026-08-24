import { recommendCategory } from "@/lib/engine/reveal";
import { assertNoNamedProducts } from "@/lib/engine/guardrails";
import type { PracticeCaseCandidate } from "./generate-cases";

export type ValidationResult = { valid: true } | { valid: false; reason: string };

/**
 * Never throws — every rejection reason (guardrail trip, category mismatch,
 * or any failure from recommendCategory itself) is captured and returned, so
 * run-pipeline.ts can drop one bad candidate without losing the rest of the
 * batch.
 */
export async function validateCandidate(
  candidate: PracticeCaseCandidate
): Promise<ValidationResult> {
  try {
    // Checked separately from recommendCategory's own internal guardrail
    // checks: those cover the MODEL's generated explanation text, not the
    // candidate's own input scenario, which came from a different call site
    // (generate-cases.ts) and could itself name a product.
    assertNoNamedProducts(candidate.rawInput, "practice-candidate.rawInput");

    // The candidate's "correct answer" is never stored (see the design
    // spec's Non-goal section) — this call exists only to check the
    // scenario isn't so ambiguous that the live engine would disagree with
    // what it was generated for.
    const result = await recommendCategory({
      goal: candidate.rawInput,
      problemType: candidate.rawInput,
      guessedCategory: candidate.intendedCategory,
    });

    if (result.revealedCategory !== candidate.intendedCategory) {
      return {
        valid: false,
        reason: `Live engine disagrees with intended category: generated for "${candidate.intendedCategory}", live engine revealed "${result.revealedCategory}" — scenario is likely too ambiguous.`,
      };
    }

    return { valid: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { valid: false, reason: message };
  }
}
