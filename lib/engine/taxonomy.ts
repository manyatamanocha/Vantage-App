/**
 * The fixed set of AI-approach categories. Both sides of the guess-then-reveal
 * mechanic read from this one list: the guess UI renders it as tap targets, and
 * the reveal prompt constrains the model to choose from it. Adding a category
 * here changes both at once — that is the point.
 */
export const CATEGORY_TAXONOMY = [
  "Classification",
  "RAG",
  "Prediction",
  "Summarization",
  "Generation",
  "Extraction",
  "Recommendation",
  "Anomaly Detection",
] as const;

export type Category = (typeof CATEGORY_TAXONOMY)[number];

export function isCategory(value: string): value is Category {
  return (CATEGORY_TAXONOMY as readonly string[]).includes(value);
}
