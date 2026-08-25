import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { runRevealStep } from "./actions";
import type { RevealResult } from "@/lib/engine/reveal";
import type { Category } from "@/lib/engine/taxonomy";
import { CATEGORY_GLOSS } from "@/lib/engine/category-gloss";
import { EndingCard } from "@/components/ending-card";

const TOOL_CLASS_GLOSS: Record<RevealResult["toolClass"], string> = {
  "general-purpose":
    "A general-purpose AI assistant can carry this, working from a prompt and the material you give it.",
  specialized:
    "This needs a purpose-built system of its own — its own data, retrieval, or trained model.",
};

type Alternative = { category: string; reason: string };

/**
 * `why_not_alternatives` is jsonb, so it arrives as unvalidated JSON. Anything
 * that isn't the shape this screen renders is dropped rather than trusted.
 */
function toAlternatives(value: unknown): Alternative[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (entry): entry is Alternative =>
      typeof entry === "object" &&
      entry !== null &&
      typeof (entry as Alternative).category === "string" &&
      typeof (entry as Alternative).reason === "string"
  );
}

export default async function RevealPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await getSupabaseServerClient();
  const { data: solve } = await supabase
    .from("solves")
    .select(
      "guessed_category, revealed_category, tool_class, correct, why_it_fits, why_not_alternatives"
    )
    .eq("id", id)
    .single();

  // The reveal only means anything after the guess is locked in.
  if (!solve?.guessed_category) redirect(`/solve/${id}/guess`);

  // The model runs once. A reload must not spend a second Groq call or rewrite
  // the recorded verdict — `correct` is the user's progress record, and a
  // re-generated answer could silently flip it. Everything this screen shows is
  // persisted by `runRevealStep`, so a revealed solve re-renders from the row.
  const reveal: RevealResult | null = solve.revealed_category
    ? null
    : await runRevealStep(id);

  const guessedCategory = solve.guessed_category as string;
  const revealedCategory =
    reveal?.revealedCategory ?? (solve.revealed_category as string);
  const toolClass = (reveal?.toolClass ??
    solve.tool_class) as RevealResult["toolClass"];
  const match = reveal?.match ?? (solve.correct as boolean);
  const whyItFits = reveal?.whyItFits ?? (solve.why_it_fits as string | null);
  const whyNotAlternatives: Alternative[] =
    reveal?.whyNotAlternatives ?? toAlternatives(solve.why_not_alternatives);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 py-8 sm:px-8 sm:py-12">
      <header>
        <h1 className="display">{match ? "You had it." : "Not quite."}</h1>
        <p className="lede">Let&apos;s discuss the takeaway.</p>
      </header>

      <div className="compare-grid">
        <div className="card">
          <span className="card-label">Your guess</span>
          <h3>{guessedCategory}</h3>
        </div>
        <div className="card">
          <span className="card-label">Correct answer</span>
          <h3>{revealedCategory}</h3>
        </div>
      </div>

      <div className="tag-row">
        <span className={`tag ${match ? "good" : "weak"}`}>{match ? "Matched" : "Missed"}</span>
      </div>

      {whyItFits && whyNotAlternatives.length > 0 ? (
        <>
          <section className="card stack">
            <span className="card-label">Why it fits</span>
            <p className="card-text">{whyItFits}</p>
          </section>

          <section className="card stack">
            <span className="card-label">Why not the others</span>
            <div className="stack">
              {whyNotAlternatives.map((alternative) => (
                <div key={alternative.category}>
                  <div style={{ fontWeight: 650, fontSize: 14 }}>{alternative.category}</div>
                  <p className="card-text" style={{ color: "var(--muted-foreground)" }}>{alternative.reason}</p>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : (
        // Solves revealed before the reasoning columns existed have only the
        // verdict stored. Nothing is invented to fill the gap, and the model is
        // not re-run to regenerate it.
        <p className="card-text">You worked through this one already — here&apos;s what you landed on.</p>
      )}

      {toolClass ? (
        <section className="card stack">
          <span className="card-label">Recommended tool class</span>
          <p className="card-text" style={{ fontWeight: 650 }}>{toolClass}</p>
          <p className="card-text" style={{ color: "var(--muted-foreground)" }}>{TOOL_CLASS_GLOSS[toolClass]}</p>
        </section>
      ) : null}

      {CATEGORY_GLOSS[revealedCategory as Category] ? (
        <EndingCard
          explainMore={CATEGORY_GLOSS[revealedCategory as Category].explainMore}
          example={CATEGORY_GLOSS[revealedCategory as Category].example}
          followupPlaceholder="e.g. What if a request doesn't fit any category cleanly?"
        />
      ) : null}

      <div className="actions">
        <Link href={`/solve/${id}/summary`} className="btn btn-primary">
          Continue to summary →
        </Link>
      </div>
    </main>
  );
}
