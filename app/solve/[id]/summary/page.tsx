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
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-5 py-8 sm:px-8 sm:py-12">
        <header>
          <h1 className="text-3xl font-semibold tracking-tight">
            This solve isn&apos;t finished yet
          </h1>
          <p className="mt-2 text-muted-foreground">
            Lock in a guess and see the reveal before checking the summary.
          </p>
        </header>
        <Link
          href={restartHref}
          className="inline-flex h-10 w-fit items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Continue where you left off
        </Link>
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
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-5 py-8 sm:px-8 sm:py-12">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">
          {solve.correct ? "You had it." : "Not quite."}
        </h1>
        <p className="mt-2 text-muted-foreground">Saved to your record.</p>
      </header>

      {hasStructuredProblem ? (
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <span className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            The problem
          </span>
          <p className="mt-2 text-sm leading-6">
            <strong>Goal:</strong> {solve.goal}
          </p>
          <p className="mt-1 text-sm leading-6">
            <strong>Problem type:</strong> {solve.problem_type}
          </p>
        </section>
      ) : null}

      <section className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div>
          <span className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Your answer
          </span>
          <p className="mt-2 text-sm leading-6">
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
        <span
          className={
            "inline-flex flex-shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold " +
            (solve.correct
              ? "bg-primary/10 text-primary"
              : "bg-destructive/10 text-destructive")
          }
        >
          {solve.correct ? "Matched" : "Missed"}
        </span>
      </section>

      {solve.why_it_fits ? (
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <span className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Why {solve.revealed_category} fits
          </span>
          <p className="mt-2 text-sm leading-6">{solve.why_it_fits}</p>
        </section>
      ) : null}

      {takeaway?.draft_text ? (
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <span className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Your client takeaway
          </span>
          <div className="mt-2">
            <HandbackViewer draftText={takeaway.draft_text} />
          </div>
        </div>
      ) : (
        // Generation is on-demand — nothing upstream of this screen ever
        // triggers it automatically.
        <form action={generateTakeaway}>
          <button
            type="submit"
            className="inline-flex h-10 w-full items-center justify-center rounded-lg border border-border bg-secondary px-4 text-sm font-semibold text-secondary-foreground hover:bg-secondary/75 sm:w-auto"
          >
            Generate a client takeaway
          </button>
        </form>
      )}

      <nav aria-label="What's next" className="flex flex-col gap-2 sm:flex-row">
        <Link
          href="/solve/new"
          className="inline-flex h-10 flex-1 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Solve another
        </Link>
        <Link
          href="/practice/today"
          className="inline-flex h-10 flex-1 items-center justify-center rounded-lg border border-border bg-secondary px-4 text-sm font-semibold text-secondary-foreground hover:bg-secondary/75"
        >
          Today&apos;s practice
        </Link>
        <Link
          href="/"
          className="inline-flex h-10 flex-1 items-center justify-center rounded-lg px-4 text-sm font-semibold text-muted-foreground hover:bg-secondary/50"
        >
          Home
        </Link>
      </nav>
    </main>
  );
}
