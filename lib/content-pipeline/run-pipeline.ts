import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { generatePracticeCaseCandidates, type PracticeCaseCandidate } from "./generate-cases";
import { dedupeCandidates } from "./dedupe";
import { validateCandidate } from "./validate-candidate";
import { CATEGORY_TAXONOMY } from "@/lib/engine/taxonomy";

export type PipelineSummary = {
  generated: number;
  rejectedDuplicate: number;
  rejectedValidation: number;
  inserted: number;
};

export async function runContentPipeline(): Promise<PipelineSummary> {
  const supabase = getSupabaseAdminClient();

  // generatePracticeCaseCandidates() is documented to return one candidate per
  // taxonomy category, but nothing in its own contract enforces that — cap
  // here so a model that returns more than expected can't blow through the
  // sequential-validation loop below and the Groq rate limit it protects.
  const candidates = (await generatePracticeCaseCandidates()).slice(0, CATEGORY_TAXONOMY.length);

  // Deliberately not filtered to `active: true` — a deactivated (retired)
  // case is still real prior content. Comparing only against active rows
  // would let the pipeline regenerate a near-duplicate of something a human
  // just retired.
  const { data: existingRows, error: fetchErr } = await supabase
    .from("practice_cases")
    .select("raw_input");
  if (fetchErr) throw new Error(fetchErr.message);
  const existingRawInputs = (existingRows as { raw_input: string }[]).map((r) => r.raw_input);

  const deduped = dedupeCandidates(candidates, existingRawInputs);
  const rejectedDuplicate = candidates.length - deduped.length;

  // Sequential, not Promise.all: this repo has already hit Groq's free-tier
  // rate limit doing this once (see tests/eval/category-accuracy.test.ts),
  // and validateCandidate makes one Groq call per candidate.
  const toInsert: PracticeCaseCandidate[] = [];
  let rejectedValidation = 0;
  for (const candidate of deduped) {
    const result = await validateCandidate(candidate);
    if (result.valid) {
      toInsert.push(candidate);
    } else {
      rejectedValidation += 1;
      // Rejection reasons are otherwise invisible once this runs unattended
      // on a schedule — this is the only signal for tuning generation
      // prompts or the validation threshold from real acceptance rates.
      console.warn(
        `[content-pipeline] rejected candidate (${candidate.intendedCategory}): ${result.reason} — "${candidate.rawInput.slice(0, 80)}"`
      );
    }
  }

  if (toInsert.length > 0) {
    const { error: insertErr } = await supabase.from("practice_cases").insert(
      // Only these three columns — the candidate's intendedCategory is
      // deliberately never written. See the design spec's Non-goal section:
      // recommendCategory() decides the category live, every time a user
      // plays the case, exactly as it does today.
      toInsert.map((c) => ({
        raw_input: c.rawInput,
        industry: c.industry,
        difficulty: c.difficulty,
      }))
    );
    if (insertErr) throw new Error(insertErr.message);
  }

  return {
    generated: candidates.length,
    rejectedDuplicate,
    rejectedValidation,
    inserted: toInsert.length,
  };
}
