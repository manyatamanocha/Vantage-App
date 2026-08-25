import Link from "next/link";
import { Layers, Sparkles } from "lucide-react";

export default function PracticeLauncherPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 py-8 sm:px-8 sm:py-12">
      <div className="topline"><span className="datechip">Practice</span></div>
      <header>
        <h1 className="display">How do you want to practice?</h1>
        <p className="lede">Work through a scenario-based problem, or jump into today&apos;s quiz.</p>
      </header>
      <section className="grid-2">
        <Link href="/practice/scenario" className="panel-link outline group">
          <Layers className="icon size-7" aria-hidden="true" />
          <h2>Scenario Based Question</h2>
          <p className="panel-lede">Solve a real-world client problem and choose the best approach.</p>
        </Link>
        <Link href="/practice/quiz" className="panel-link outline group">
          <Sparkles className="icon size-7" aria-hidden="true" />
          <h2>Quiz</h2>
          <p className="panel-lede">Test your understanding of concepts with quick questions.</p>
        </Link>
      </section>
    </main>
  );
}
