"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { CATEGORY_TAXONOMY, type Category } from "@/lib/engine/taxonomy";
import { CategorySelector } from "@/components/category-selector";
import { submitPracticeGuess } from "./actions";
import type { RevealResult } from "@/lib/engine/reveal";

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
      <>
        <h1>{reveal.match ? "You had it." : "Not quite."}</h1>
        <p>
          You guessed <strong>{selected}</strong>. This is a{" "}
          <strong>{reveal.revealedCategory}</strong> problem.
        </p>

        <section>
          <h2>Why {reveal.revealedCategory} fits</h2>
          <p>{reveal.whyItFits}</p>
        </section>

        <section>
          <h2>Why not the alternatives</h2>
          <dl>
            {reveal.whyNotAlternatives.map((alternative) => (
              <div key={alternative.category}>
                <dt>{alternative.category}</dt>
                <dd>{alternative.reason}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section>
          <h2>Tool class</h2>
          <p>
            <strong>{reveal.toolClass}</strong> —{" "}
            {TOOL_CLASS_GLOSS[reveal.toolClass]}
          </p>
        </section>

        <section aria-label="Learn and remember">
          <h2>Learn &amp; remember</h2>
          <p>
            <strong>Key takeaway:</strong> {reveal.whyItFits}
          </p>
          {reveal.whyNotAlternatives[0] ? (
            <p>
              <strong>Common pitfall:</strong> Reaching for{" "}
              {reveal.whyNotAlternatives[0].category} — {reveal.whyNotAlternatives[0].reason}
            </p>
          ) : null}
        </section>

        {/*
          Previously the reveal was a dead end — the practice loop ended here
          with no way forward. These mirror the live loop's own post-reveal
          routing: the reveal screen there links to the summary, which is where
          the takeaway artifact is offered.
        */}
        <nav aria-label="What's next" className="flex flex-wrap gap-4 pt-4 text-sm">
          <Link href={`/solve/${reveal.solveId}/summary`} className="underline">
            See the summary
          </Link>
          <Link href="/practice/history" className="underline">
            Practice history
          </Link>
          <Link href="/" className="underline">
            Done for today
          </Link>
        </nav>
      </>
    );
  }

  return (
    <>
      <h1>Today&apos;s practice case</h1>
      <p className="text-sm opacity-70">
        {matchedPreferredDifficulty
          ? `Difficulty: ${difficulty}`
          : `Nothing seeded at your preferred difficulty yet — here's a ${difficulty} case instead.`}
      </p>
      <p>{rawInput}</p>
      <p>What kind of AI problem is this?</p>

      <CategorySelector
        taxonomy={CATEGORY_TAXONOMY}
        selected={selected}
        onSelect={setSelected}
      />

      {error ? <p role="alert">{error}</p> : null}

      <button type="button" onClick={lockIn} disabled={!selected || isSubmitting}>
        {isSubmitting ? "Revealing…" : "Lock in guess"}
      </button>
    </>
  );
}
