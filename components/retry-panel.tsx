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
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 py-8 sm:px-8 sm:py-12">
      <div className="topline">
        <span className="datechip">Something went wrong</span>
      </div>
      <header>
        <h1 className="display">{title}</h1>
        <p className="lede">Nothing you&apos;ve entered was lost. Try that step again.</p>
      </header>
      <div className="actions">
        <button type="button" onClick={reset} className="btn btn-primary">
          Try again
        </button>
        <Link href={backHref} className="btn btn-secondary">
          {backLabel}
        </Link>
      </div>
    </main>
  );
}
