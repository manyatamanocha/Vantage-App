"use client";

import { useEffect } from "react";
import { RetryPanel } from "@/components/retry-panel";

/**
 * Covers /practice/today and /practice/history. Beyond the reveal call itself,
 * this is what catches an environment whose `practice_cases` table has not been
 * seeded (see supabase/migrations/0004_seed_practice_cases.sql) — previously
 * that threw straight through to Next's generic error page.
 */
export default function PracticeError({
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
      title="Today's practice didn't load."
      reset={reset}
      backHref="/"
      backLabel="Back to home"
    />
  );
}
