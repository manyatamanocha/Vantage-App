/**
 * A plain in-process token-overlap similarity check, not an embeddings call —
 * deliberate, per the design spec's "no new paid services" constraint. At the
 * scale this pipeline operates on (tens to low hundreds of practice cases),
 * this is precise enough to catch near-duplicate phrasing without adding a
 * new external dependency.
 */
export const DUPLICATE_THRESHOLD = 0.5;

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(Boolean)
  );
}

export function jaccardSimilarity(a: string, b: string): number {
  const setA = tokenize(a);
  const setB = tokenize(b);
  if (setA.size === 0 && setB.size === 0) return 1;
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection += 1;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 1 : intersection / union;
}

/**
 * Drops any candidate that's too similar to an existing row or to a
 * previously-kept candidate earlier in the same batch. Kept candidates are
 * checked against subsequent ones, so a run-on batch never inserts two
 * near-duplicates of each other even if neither matches anything in the DB.
 */
export function dedupeCandidates<T extends { rawInput: string }>(
  candidates: T[],
  existingRawInputs: string[]
): T[] {
  const kept: T[] = [];
  const comparisonPool = [...existingRawInputs];

  for (const candidate of candidates) {
    const isDuplicate = comparisonPool.some(
      (text) => jaccardSimilarity(candidate.rawInput, text) >= DUPLICATE_THRESHOLD
    );
    if (!isDuplicate) {
      kept.push(candidate);
      comparisonPool.push(candidate.rawInput);
    }
  }

  return kept;
}
