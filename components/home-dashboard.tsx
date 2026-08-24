import Link from "next/link";
import { ArrowRight, BrainCircuit, BriefcaseBusiness, ChartNoAxesCombined } from "lucide-react";

type HomeDashboardProps = {
  firstName: string;
  today: string;
  firstGuessAccuracy: number;
  completedCount: number;
};

export function HomeDashboard({
  firstName,
  today,
  firstGuessAccuracy,
  completedCount,
}: HomeDashboardProps) {
  const accuracy = `${Math.round(firstGuessAccuracy * 100)}% first-guess accuracy`;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-5 py-8 sm:px-8 sm:py-12">
      <section className="flex items-start justify-between gap-4">
        <div>
          <p className="mb-2 text-sm font-medium text-primary">Your AI judgment practice</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Welcome, {firstName}</h1>
          <p className="mt-2 max-w-xl text-base text-muted-foreground">
            Build sharper instincts for matching client problems to the right AI approach.
          </p>
        </div>
        <time className="hidden shrink-0 rounded-full bg-secondary px-3 py-1.5 text-xs font-medium text-muted-foreground sm:block">
          {today}
        </time>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Link
          href="/solve/new"
          className="group rounded-2xl border border-primary/20 bg-primary p-6 text-primary-foreground shadow-sm transition-transform hover:-translate-y-0.5 hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <BriefcaseBusiness className="mb-10 size-6" aria-hidden="true" />
          <p className="text-sm font-medium text-primary-foreground/75">Reactive mode</p>
          <h2 className="mt-1 text-xl font-semibold">Solve a client problem</h2>
          <p className="mt-2 max-w-sm text-sm leading-6 text-primary-foreground/80">
            I have a client problem right now.
          </p>
          <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold">
            Solve a problem <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
          </span>
        </Link>

        <Link
          href="/practice/today"
          className="group rounded-2xl border border-border bg-card p-6 shadow-sm transition-transform hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <BrainCircuit className="mb-10 size-6 text-primary" aria-hidden="true" />
          <p className="text-sm font-medium text-primary">Proactive mode</p>
          <h2 className="mt-1 text-xl font-semibold">Practice your AI judgment</h2>
          <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">
            Take today&apos;s client challenge.
          </p>
          <span className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary">
            Start today&apos;s practice <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
          </span>
        </Link>
      </section>

      <section className="border-t border-border pt-7">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ChartNoAxesCombined className="size-4 text-primary" aria-hidden="true" />
            <h2 className="font-semibold">Your progress</h2>
          </div>
          <Link href="/progress" className="text-sm font-medium text-primary hover:underline">
            View progress <span aria-hidden="true">→</span>
          </Link>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary">
            {completedCount ? accuracy : "Your accuracy will appear here"}
          </span>
          <span className="rounded-full bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground">
            {completedCount} {completedCount === 1 ? "solve" : "solves"} completed
          </span>
        </div>
      </section>
    </main>
  );
}
