export function similarity(a: string, b: string): number {
  const left = new Set(a.toLowerCase().split(/\W+/).filter(Boolean));
  const right = new Set(b.toLowerCase().split(/\W+/).filter(Boolean));
  const intersection = [...left].filter((token) => right.has(token)).length;
  const union = new Set([...left, ...right]).size;
  return union ? intersection / union : 1;
}

export function dedupeQuestions<T extends { term: string; questionText: string }>(items: T[], existing: string[]): T[] {
  const seen = [...existing];
  const kept: T[] = [];
  for (const item of items) {
    const key = `${item.term} ${item.questionText}`;
    if (seen.every((old) => similarity(key, old) < 0.5)) {
      kept.push(item);
      seen.push(key);
    }
  }
  return kept;
}
