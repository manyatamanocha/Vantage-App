"use client";

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
  solveId,
  rawInput,
}: {
  solveId: string;
  rawInput: string;
}) {
  const [selected, setSelected] = useState<Category | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reveal, setReveal] = useState<RevealResult | null>(null);
  const [isSubmitting, startSubmitting] = useTransition();

  function lockIn() {
    if (!selected || isSubmitting) return;
    setError(null);
    startSubmitting(async () => {
      try {
        const result = await submitPracticeGuess(solveId, selected);
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
          <h2>Learn & remember</h2>
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
      </>
    );
  }

  return (
    <>
      <h1>Today&apos;s practice case</h1>
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
