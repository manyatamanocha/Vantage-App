"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { CATEGORY_TAXONOMY, type Category } from "@/lib/engine/taxonomy";
import { CategorySelector } from "@/components/category-selector";
import { submitPracticeGuess } from "./actions";
import type { RevealResult } from "@/lib/engine/reveal";
import { CATEGORY_GLOSS } from "@/lib/engine/category-gloss";
import { EndingCard } from "@/components/ending-card";

const TOOL_CLASS_GLOSS: Record<RevealResult["toolClass"], string> = {
  "general-purpose":
    "A general-purpose AI assistant can carry this, working from a prompt and the material you give it.",
  specialized:
    "This needs a purpose-built system of its own — its own data, retrieval, or trained model.",
};

// Guess and reveal live on one screen here, but the guess half stays exactly
// as client-only as Task 6's: selection is instant and depends on no network
// call. The only request this component makes is the combined lock-in +
// reveal write.
export function PracticeSession({
  practiceCaseId,
  rawInput,
  difficulty,
  matchedPreferredDifficulty,
}: {
  practiceCaseId: string;
  rawInput: string;
  difficulty: string;
  matchedPreferredDifficulty: boolean;
}) {
  const [selected, setSelected] = useState<Category | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reveal, setReveal] = useState<
    (RevealResult & { solveId: string }) | null
  >(null);
  const [isSubmitting, startSubmitting] = useTransition();

  function lockIn() {
    if (!selected || isSubmitting) return;
    setError(null);
    startSubmitting(async () => {
      try {
        const result = await submitPracticeGuess(practiceCaseId, selected);
        setReveal(result);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not reveal this one.");
      }
    });
  }

  if (reveal) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 py-8 sm:px-8 sm:py-12">
        <div className="topline"><span className="datechip">Daily practice</span></div>
        <header>
          <h1 className="display">{reveal.match ? "You had it." : "Not quite."}</h1>
          <p className="lede">
          You guessed <strong>{selected}</strong>. This is a{" "}
          <strong>{reveal.revealedCategory}</strong> problem.
          </p>
        </header>

        <section className="card stack">
          <span className="card-label">Why it fits</span>
          <p className="card-text">{reveal.whyItFits}</p>
        </section>

        <section className="card stack">
          <span className="card-label">Why not the alternatives</span>
          <dl className="stack">
            {reveal.whyNotAlternatives.map((alternative) => (
              <div key={alternative.category}>
                <dt>{alternative.category}</dt>
                <dd>{alternative.reason}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="card stack">
          <span className="card-label">Recommended tool class</span>
          <p className="card-text">
            <strong>{reveal.toolClass}</strong> —{" "}
            {TOOL_CLASS_GLOSS[reveal.toolClass]}
          </p>
        </section>

        <section aria-label="Learn and remember" className="quote-card">
          <span className="card-label">Learn &amp; remember</span>
          <p className="card-text">
            <strong>Key takeaway:</strong> {reveal.whyItFits}
          </p>
          {reveal.whyNotAlternatives[0] ? (
            <p>
              <strong>Common pitfall:</strong> Reaching for{" "}
              {reveal.whyNotAlternatives[0].category} — {reveal.whyNotAlternatives[0].reason}
            </p>
          ) : null}
        </section>

        {CATEGORY_GLOSS[reveal.revealedCategory as Category] ? (
          <EndingCard
            explainMore={CATEGORY_GLOSS[reveal.revealedCategory as Category].explainMore}
            example={CATEGORY_GLOSS[reveal.revealedCategory as Category].example}
            followupPlaceholder="e.g. What if a request doesn't fit any category cleanly?"
          />
        ) : null}

        {/*
          Previously the reveal was a dead end — the practice loop ended here
          with no way forward. These mirror the live loop's own post-reveal
          routing: the reveal screen there links to the summary, which is where
          the takeaway artifact is offered.
        */}
        <nav aria-label="What's next" className="actions">
          <Link href={`/solve/${reveal.solveId}/summary`} className="btn btn-primary">
            See the summary
          </Link>
          <Link href="/practice/history" className="btn btn-secondary">
            Practice history
          </Link>
          <Link href="/" className="btn btn-ghost">
            Done for today
          </Link>
        </nav>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 py-8 sm:px-8 sm:py-12">
      <div className="topline"><span className="datechip">Daily practice</span></div>
      <header>
      <h1 className="display">Today&apos;s practice case</h1>
      <p className="lede">
        {matchedPreferredDifficulty
          ? `Difficulty: ${difficulty}`
          : `Nothing seeded at your preferred difficulty yet — here's a ${difficulty} case instead.`}
      </p>
      </header>
      <section className="quote-card stack"><span className="card-label">Today&apos;s challenge</span><p className="card-text">{rawInput}</p></section>
      <section className="stack"><p className="card-label">Which approach fits best?</p>

      <CategorySelector
        taxonomy={CATEGORY_TAXONOMY}
        selected={selected}
        onSelect={setSelected}
      /></section>

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

      <div className="actions"><button className="btn btn-primary" type="button" onClick={lockIn} disabled={!selected || isSubmitting}>
        {isSubmitting ? "Revealing…" : "Lock in guess"}
      </button></div>
    </main>
  );
}
