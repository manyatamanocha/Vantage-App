import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { runRevealStep } from "./actions";
import type { RevealResult } from "@/lib/engine/reveal";

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
    <main>
      <h1>{match ? "You had it." : "Not quite."}</h1>
      <p>
        You guessed <strong>{guessedCategory}</strong>. This is a{" "}
        <strong>{revealedCategory}</strong> problem.
      </p>

      {whyItFits && whyNotAlternatives.length > 0 ? (
        <>
          <section>
            <h2>Why {revealedCategory} fits</h2>
            <p>{whyItFits}</p>
          </section>

          <section>
            <h2>Why not the alternatives</h2>
            <dl>
              {whyNotAlternatives.map((alternative) => (
                <div key={alternative.category}>
                  <dt>{alternative.category}</dt>
                  <dd>{alternative.reason}</dd>
                </div>
              ))}
            </dl>
          </section>
        </>
      ) : (
        // Solves revealed before the reasoning columns existed have only the
        // verdict stored. Nothing is invented to fill the gap, and the model is
        // not re-run to regenerate it.
        <p>You worked through this one already — here&apos;s what you landed on.</p>
      )}

      <section>
        <h2>Tool class</h2>
        <p>
          <strong>{toolClass}</strong>
          {toolClass ? ` — ${TOOL_CLASS_GLOSS[toolClass]}` : null}
        </p>
      </section>

      <Link href={`/solve/${id}/summary`}>Continue</Link>
    </main>
  );
}
