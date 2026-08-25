export function similarity(a: string, b: string): number {
  const left = new Set(a.toLowerCase().split(/\W+/).filter(Boolean));
  const right = new Set(b.toLowerCase().split(/\W+/).filter(Boolean));
  const intersection = [...left].filter((token) => right.has(token)).length;
  const union = new Set([...left, ...right]).size;
  return union ? intersection / union : 1;
}

export function dedupeQuestions<T extends { term: string; questionText: string }>(
  items: T[],
  existing: { term: string; questionText: string }[]
): T[] {
  const seenKeys = existing.map((old) => `${old.term} ${old.questionText}`);
  const seenTerms = new Set(existing.map((old) => old.term.trim().toLowerCase()));
  const kept: T[] = [];
  for (const item of items) {
    const term = item.term.trim().toLowerCase();
    if (seenTerms.has(term)) continue;
    const key = `${item.term} ${item.questionText}`;
    if (seenKeys.every((old) => similarity(key, old) < 0.5)) {
      kept.push(item);
      seenKeys.push(key);
      seenTerms.add(term);
    }
  }
  return kept;
}
