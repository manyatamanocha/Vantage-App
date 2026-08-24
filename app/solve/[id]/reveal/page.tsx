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
      "guessed_category, revealed_category, tool_class, correct, why_it_fits, why_not_alternatives, solution"
    )
    .eq("id", id)
    .single();

  // The reveal only means anything after the guess is locked in.
  if (!solve?.guessed_category) redirect(`/solve/${id}/guess`);

  // The model runs once. A reload must not spend a second Groq call or rewrite
  // the recorded verdict — `correct` is the user's progress record, and a
  // re-generated answer could silently flip it. Everything this screen shows is
  // persisted by `runRevealStep`, so a revealed solve re-renders from the row.
  const reveal: (RevealResult & { solution: string }) | null = solve.revealed_category
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
  const solution = reveal?.solution ?? (solve.solution as string | null);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-5 py-8 sm:px-8 sm:py-12">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">
          {match ? "You had it." : "Not quite."}
        </h1>
        <p className="mt-2 text-muted-foreground">Let&apos;s discuss the takeaway.</p>
      </header>

      {solution ? (
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <span className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Solution
          </span>
          <p className="mt-2 whitespace-pre-line text-base leading-6">{solution}</p>
        </section>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <span className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Your guess
          </span>
          <p className="mt-1 text-lg font-semibold">{guessedCategory}</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <span className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Correct answer
          </span>
          <p className="mt-1 text-lg font-semibold">{revealedCategory}</p>
        </div>
      </div>

      <span
        className={
          "inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold " +
          (match
            ? "bg-primary/10 text-primary"
            : "bg-destructive/10 text-destructive")
        }
      >
        {match ? "Matched" : "Missed"}
      </span>

      {whyItFits && whyNotAlternatives.length > 0 ? (
        <>
          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <span className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Why it fits
            </span>
            <p className="mt-2 text-base leading-6">{whyItFits}</p>
          </section>

          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <span className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Why not the others
            </span>
            <dl className="mt-3 flex flex-col gap-3">
              {whyNotAlternatives.map((alternative) => (
                <div key={alternative.category}>
                  <dt className="text-sm font-semibold">{alternative.category}</dt>
                  <dd className="mt-0.5 text-sm text-muted-foreground">{alternative.reason}</dd>
                </div>
              ))}
            </dl>
          </section>
        </>
      ) : (
        // Solves revealed before the reasoning columns existed have only the
        // verdict stored. Nothing is invented to fill the gap, and the model is
        // not re-run to regenerate it.
        <p className="text-muted-foreground">
          You worked through this one already — here&apos;s what you landed on.
        </p>
      )}

      {toolClass ? (
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <span className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Recommended tool class
          </span>
          <p className="mt-2 text-base font-semibold">{toolClass}</p>
          <p className="mt-1 text-sm text-muted-foreground">{TOOL_CLASS_GLOSS[toolClass]}</p>
        </section>
      ) : null}

      {CATEGORY_GLOSS[revealedCategory as Category] ? (
        <EndingCard
          explainMore={CATEGORY_GLOSS[revealedCategory as Category].explainMore}
          example={CATEGORY_GLOSS[revealedCategory as Category].example}
          followupPlaceholder="e.g. What if a request doesn't fit any category cleanly?"
        />
      ) : null}

      <Link
        href={`/solve/${id}/summary`}
        className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 sm:w-auto"
      >
        Continue to summary →
      </Link>
    </main>
  );
}
