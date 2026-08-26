import Link from "next/link";
import { ArrowRight, Bot, BriefcaseBusiness } from "lucide-react";
import { Greeting } from "@/components/greeting";
import type { ContinueSolve } from "@/app/home-actions";

export function HomeDashboard({
  quizHref,
  continueSolve,
}: {
  quizHref: string;
  continueSolve: ContinueSolve | null;
}) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 pt-1 pb-8 sm:px-8 sm:pt-2 sm:pb-12">
      <section className="topline">
        <div>
          <h1 className="font-heading text-[22px] font-bold tracking-tight">
            <Greeting />
          </h1>
          <p className="lede">Sharpen your instinct for the right AI approach.</p>
        </div>
      </section>

      <section className="stack" style={{ gap: 10, marginTop: 18 }}>
        <Link href="/solve/new" className="panel-link outline bold-bounce group">
          <span className="panel-link-blob" aria-hidden="true" />
          <div className="panel-link-icon">
            <BriefcaseBusiness className="size-5" aria-hidden="true" />
          </div>
          <div className="panel-link-text">
            <h2>Let&apos;s Solve</h2>
            <p className="panel-lede">Bring a real client problem and get an AI approach.</p>
            <span className="panel-link-cta-pill">
              Start solving <ArrowRight size={13} aria-hidden="true" />
            </span>
          </div>
        </Link>

        <Link href={quizHref} className="panel-link outline bold-bounce group">
          <span className="panel-link-blob" aria-hidden="true" />
          <div className="panel-link-icon">
            <Bot className="size-5" aria-hidden="true" />
          </div>
          <div className="panel-link-text">
            <h2>Quiz time</h2>
            <p className="panel-lede">Daily quizzes to test and sharpen your judgment.</p>
            <span className="panel-link-cta-pill">
              Start quiz <ArrowRight size={13} aria-hidden="true" />
            </span>
          </div>
        </Link>
      </section>

      {continueSolve ? (
        <section className="stack">
          <span className="card-label">Continue where you left off</span>
          <Link href={`/solve/${continueSolve.id}/summary`} className="panel-link outline bold-bounce group">
            <span className="panel-link-blob" aria-hidden="true" />
            <div className="panel-link-icon">
              <BriefcaseBusiness className="size-5" aria-hidden="true" />
            </div>
            <div className="panel-link-text">
              <h2>{continueSolve.title}</h2>
              <p className="panel-lede">
                Last worked on {new Date(continueSolve.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </p>
              <span className="panel-link-cta-pill">
                Continue <ArrowRight size={13} aria-hidden="true" />
              </span>
            </div>
          </Link>
        </section>
      ) : null}
    </main>
  );
}
