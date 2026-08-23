"use client";

import Link from "next/link";

/**
 * The retry state the spec asks for on AI-dependent steps. The failures that
 * actually reach here are the Groq call sites' own thrown errors — a timeout
 * after the single retry, a truncated completion caught by `checkFinishReason`,
 * a response that didn't parse. All are worth trying again, and none of them
 * cost the user anything already saved: every earlier step persisted its own
 * result before the failing one started.
 *
 * The error's message is not rendered. These strings are internal diagnostics
 * ("handback response was truncated…"), not something a consultant mid-session
 * can act on.
 */
export function RetryPanel({
  title,
  reset,
  backHref,
  backLabel,
}: {
  title: string;
  reset: () => void;
  backHref: string;
  backLabel: string;
}) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="text-sm opacity-70">
        Nothing you&apos;ve entered was lost. Try that step again.
      </p>
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <button
          type="button"
          onClick={reset}
          className="rounded bg-foreground px-4 py-2 text-background"
        >
          Try again
        </button>
        <Link href={backHref} className="underline">
          {backLabel}
        </Link>
      </div>
    </main>
  );
}
