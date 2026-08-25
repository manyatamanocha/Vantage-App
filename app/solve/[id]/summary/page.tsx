import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { createHandback } from "./actions";
import { HandbackViewer } from "./handback-viewer";

/**
 * The summary screen (2h) is the landing point after both the live flow's
 * reveal step and — eventually — the daily practice loop. It only ever
 * re-renders what `runRevealStep`/`submitPracticeGuess` (Tasks 7 and 8)
 * already persisted; it never re-runs the model.
 *
 * `goal`/`problem_type` are always NULL for `source: "practice"` rows —
 * Task 8's combined guess+reveal flow skips Task 5's structuring step
 * entirely for practice cases (see Task 8's report). This screen must not
 * assume those columns are populated just because live-sourced rows have
 * them; the "problem" section is only rendered when both are present.
 *
 * The client takeaway used to live on its own Handback screen — removed
 * 2026-08-24 (see UI Design Log.md) since it was a needless extra step for
 * content that only ever gets read once, right after the reveal. Generation
 * is still on-demand (a form submit, not automatic) and still writes to the
 * same `takeaways` row, just from this page instead of a separate route.
 */
export default async function SolveSummaryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await getSupabaseServerClient();

  const { data: solve } = await supabase
    .from("solves")
    .select(
      "source, goal, problem_type, guessed_category, revealed_category, tool_class, correct, why_it_fits"
    )
    .eq("id", id)
    .single();

  if (!solve) notFound();

  // A takeaway may simply not exist yet — that's an expected, not-yet-generated
  // state, not an error. `maybeSingle` returns null data instead of throwing on
  // zero rows, and `solve_id` is unique on `takeaways`
  // (supabase/migrations/0003_takeaways_unique_solve.sql) so it can never
  // return more than one. A real error (network failure, RLS denial, etc.)
  // must still be surfaced rather than silently treated as "no takeaway yet."
  const { data: takeaway, error: takeawayErr } = await supabase
    .from("takeaways")
    .select("draft_text")
    .eq("solve_id", id)
    .maybeSingle();
  if (takeawayErr) throw new Error(takeawayErr.message);

  const restartHref =
    solve.source === "practice" ? "/practice/today" : `/solve/${id}/guess`;

  if (!solve.revealed_category || solve.correct === null) {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 py-8 sm:px-8 sm:py-12">
        <header>
          <h1 className="display">This solve isn&apos;t finished yet</h1>
          <p className="lede">Lock in a guess and see the reveal before checking the summary.</p>
        </header>
        <div className="actions">
          <Link href={restartHref} className="btn btn-primary">
            Continue where you left off
          </Link>
        </div>
      </main>
    );
  }

  const hasStructuredProblem = Boolean(solve.goal && solve.problem_type);

  async function generateTakeaway() {
    "use server";
    await createHandback(id);
    revalidatePath(`/solve/${id}/summary`);
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 py-8 sm:px-8 sm:py-12">
      <header>
        <h1 className="display">{solve.correct ? "You had it." : "Not quite."}</h1>
        <p className="lede">Saved to your record.</p>
      </header>

      <div className="stack">
        {hasStructuredProblem ? (
          <section className="card">
            <span className="card-label">The problem</span>
            <p className="card-text">
              <strong>Goal:</strong> {solve.goal}
              <br />
              <strong>Problem type:</strong> {solve.problem_type}
            </p>
          </section>
        ) : null}

        <section className="card row-between" style={{ alignItems: "flex-start" }}>
          <div>
            <span className="card-label">Your answer</span>
            <p className="card-text">
              You guessed <strong>{solve.guessed_category}</strong>. This is a{" "}
              <strong>{solve.revealed_category}</strong> problem.
              {solve.tool_class ? (
                <>
                  {" "}
                  Tool class: <strong>{solve.tool_class}</strong>.
                </>
              ) : null}
            </p>
          </div>
          <span className={`badge ${solve.correct ? "matched" : "missed"}`}>
            {solve.correct ? "Matched" : "Missed"}
          </span>
        </section>

        {solve.why_it_fits ? (
          <section className="card">
            <span className="card-label">Why {solve.revealed_category} fits</span>
            <p className="card-text">{solve.why_it_fits}</p>
          </section>
        ) : null}

        {takeaway?.draft_text ? (
          <section className="card">
            <span className="card-label">Your client takeaway</span>
            <HandbackViewer draftText={takeaway.draft_text} />
          </section>
        ) : (
          // Generation is on-demand — nothing upstream of this screen ever
          // triggers it automatically.
          <form action={generateTakeaway} className="actions">
            <button type="submit" className="btn btn-secondary">
              Generate a client takeaway
            </button>
          </form>
        )}
      </div>

      <nav aria-label="What's next" className="actions">
        <Link href="/solve/new" className="btn btn-primary">
          Solve another problem
        </Link>
        <Link href="/practice/today" className="btn btn-secondary">
          Try today&apos;s practice
        </Link>
        <Link href="/" className="btn btn-ghost">
          Back to home
        </Link>
      </nav>
    </main>
  );
}
