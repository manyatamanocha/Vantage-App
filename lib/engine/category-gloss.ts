import type { Category } from "./taxonomy";

/**
 * Plain-language explanation + a concrete example per category, used by the
 * "Explain more" / "Example" chips on the shared EndingCard (Reveal, and the
 * practice-session in-line reveal). Static reference copy, not model output.
 */
export const CATEGORY_GLOSS: Record<Category, { explainMore: string; example: string }> = {
  Classification: {
    explainMore:
      "Every incoming item gets sorted into one of a fixed set of buckets — the same way a mail room routes letters by department, just automatic and instant.",
    example:
      "An inbox add-on that reads each support email and tags it \"Billing,\" \"Technical,\" or \"Legal\" before a human opens it.",
  },
  RAG: {
    explainMore:
      "The system looks things up in your own documents before answering, instead of relying only on what it was trained on — so answers stay grounded in your actual material.",
    example:
      "A support chatbot that answers from your product manuals and policy docs, citing the exact page it pulled from.",
  },
  Prediction: {
    explainMore:
      "The system looks at patterns in past data to estimate what's likely to happen next — a forecast, not a certainty.",
    example:
      "Flagging which subscribers are likely to cancel next month, based on how their usage has changed recently.",
  },
  Summarization: {
    explainMore:
      "Long material gets condensed down to its key points, so someone can grasp it in a fraction of the time it'd take to read the whole thing.",
    example:
      "Turning a 40-page research report into a one-paragraph executive brief.",
  },
  Generation: {
    explainMore:
      "The system produces new content from scratch based on your instructions — a first draft to edit, not a final answer.",
    example:
      "Drafting three variations of marketing copy for a product launch, for the team to pick from and refine.",
  },
  Extraction: {
    explainMore:
      "The system pulls specific pieces of information out of messy source material into a clean, structured form.",
    example:
      "Pulling dates, dollar amounts, and party names out of a scanned contract into spreadsheet columns.",
  },
  Recommendation: {
    explainMore:
      "The system suggests what's most relevant to a specific person, based on what it knows about their behavior or preferences.",
    example:
      "Suggesting which add-on product to offer a customer, based on what they've already bought.",
  },
  "Anomaly Detection": {
    explainMore:
      "The system learns what \"normal\" looks like, then flags anything that deviates from it — it doesn't know why something is wrong, only that it's unusual.",
    example:
      "Flagging a transaction that's far outside a customer's normal spending pattern for manual review.",
  },
};
