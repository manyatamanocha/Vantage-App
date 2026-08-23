"use client";

import { useEffect } from "react";
import { RetryPanel } from "@/components/retry-panel";

/**
 * Covers every step of the live loop — structure, guess, reveal, summary,
 * handback — which is where all three Groq call sites live. Without it, a
 * retryable model failure rendered Next's generic error page with no way back
 * other than the browser's Back button.
 */
export default function SolveError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <RetryPanel
      title="That step didn't come back."
      reset={reset}
      backHref="/"
      backLabel="Back to home"
    />
  );
}
