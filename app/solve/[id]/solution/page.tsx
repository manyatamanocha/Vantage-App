import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, Lightbulb, Sparkles, Wrench } from "lucide-react";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { runSolutionStep } from "./actions";
import type { SolutionResult } from "@/lib/engine/solution";

function isSolutionResult(value: unknown): value is SolutionResult {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as SolutionResult).tools) &&
    Array.isArray((value as SolutionResult).steps)
  );
}

export default async function SolutionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await getSupabaseServerClient();
  const { data: solve, error: fetchErr } = await supabase
    .from("solves")
    .select("goal, raw_input, solution")
    .eq("id", id)
    .single();

  // A silently-ignored fetchErr (e.g. the `solution` column not existing yet
  // because supabase/migrations/0006_solution.sql hasn't been applied) used to
  // fall through to `!solve?.raw_input` and redirect back to the intake
  // screen with no explanation — this throws loudly instead so the real
  // cause shows up in the error boundary rather than looking like a silent
  // "nothing happened" bug.
  if (fetchErr) throw new Error(`Could not load this solve: ${fetchErr.message}`);
  if (!solve?.raw_input) redirect("/solve/new");

  // Runs once. A reload must not spend a second Groq call — this screen
  // re-renders from the persisted row once it exists.
  const solution: SolutionResult = isSolutionResult(solve.solution)
    ? solve.solution
    : await runSolutionStep(id);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 py-8 sm:px-8 sm:py-12">
      <div className="row-between">
        <Link href="/solve/new" className="btn-ghost" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          ← Back to edit
        </Link>
        <span className="badge matched">
          <CheckCircle2 size={13} aria-hidden="true" /> Step 2 of 2
        </span>
      </div>

      <header>
        <h1 className="display">Here&apos;s your solution</h1>
      </header>

      <section
        className="card"
        style={{ borderColor: "var(--success)", boxShadow: "0 0 0 1px var(--success)" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: 999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "color-mix(in oklch, var(--success) 18%, transparent)",
              color: "var(--success)",
              flexShrink: 0,
            }}
          >
            <Sparkles size={13} aria-hidden="true" />
          </div>
          <span style={{ color: "var(--success)", fontWeight: 650, fontSize: 14 }}>Your challenge</span>
        </div>
        <p className="card-text">{solve.goal || solve.raw_input}</p>
      </section>

      <section className="stack">
        <span className="card-label">Overview</span>
        <p className="card-text">{solution.overview}</p>
      </section>

      <section className="stack">
        <span className="card-label">Step-by-step guide</span>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {solution.steps.map((step, i) => (
            <div key={step.title} style={{ display: "flex", gap: 14 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 999,
                    background: "var(--primary)",
                    color: "var(--primary-foreground)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: 13,
                    flexShrink: 0,
                  }}
                >
                  {i + 1}
                </div>
                {i < solution.steps.length - 1 ? (
                  <div style={{ width: 2, flex: 1, background: "var(--border)", margin: "4px 0" }} />
                ) : null}
              </div>
              <div className="card" style={{ marginBottom: 12, flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 4 }}>{step.title}</div>
                <p className="card-text" style={{ color: "var(--muted-foreground)" }}>{step.description}</p>
                {step.detail ? (
                  <pre
                    style={{
                      marginTop: 10,
                      padding: "10px 12px",
                      background: "var(--secondary)",
                      borderRadius: "var(--radius-md)",
                      fontSize: 12.5,
                      overflowX: "auto",
                      fontFamily: "ui-monospace, monospace",
                    }}
                  >
                    {step.detail}
                  </pre>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </section>

      {solution.tools.length > 0 ? (
      <section className="stack">
        <span className="card-label">Tools you&apos;ll need</span>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {solution.tools.map((tool) => (
            <div key={tool.name} className="card" style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: "var(--radius-md)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "var(--accent)",
                  color: "var(--accent-foreground)",
                  flexShrink: 0,
                }}
              >
                <Wrench size={16} aria-hidden="true" />
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14.5 }}>{tool.name}</div>
                <p className="card-text" style={{ color: "var(--muted-foreground)" }}>{tool.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
      ) : null}

      {solution.proTips.length > 0 ? (
        <section className="quote-card stack">
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Lightbulb size={14} style={{ color: "#F59E0B" }} aria-hidden="true" />
            <span className="card-label" style={{ margin: 0 }}>Pro tips</span>
          </div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {solution.proTips.map((tip) => (
              <li key={tip} className="card-text">{tip}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="actions" style={{ justifyContent: "center", flexDirection: "column", alignItems: "center" }}>
        <Link href="/practice/history" className="btn btn-primary">
          Try it yourself →
        </Link>
        <Link href="/solve/new" className="hint" style={{ marginTop: 8 }}>
          Go back and edit
        </Link>
      </div>
    </main>
  );
}
