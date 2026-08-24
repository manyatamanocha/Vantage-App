import Link from "next/link";
import { ArrowRight, BrainCircuit, BriefcaseBusiness } from "lucide-react";
import { LiveClock } from "@/components/live-clock";
import { ThemeToggle } from "@/components/theme-toggle";

export function HomeDashboard({ firstName }: { firstName: string }) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 py-8 sm:px-8 sm:py-12">
      <section className="topline">
        <div><h1 className="display">Welcome, {firstName}</h1><p className="lede">Build sharper instincts for matching client problems to the right AI approach.</p></div>
        <LiveClock />
      </section>
      <section className="grid-2">
        <Link href="/solve/new" className="panel-link outline group">
          <BriefcaseBusiness className="icon size-7" aria-hidden="true" />
          <h2>Solve a client problem</h2>
          <span className="panel-cta">Solve a problem <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" /></span>
        </Link>
        <Link href="/practice/jargon" className="panel-link outline group">
          <BrainCircuit className="icon size-7" aria-hidden="true" />
          <h2>Practice your AI judgment</h2>
          <span className="panel-cta">Start today&apos;s practice <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" /></span>
        </Link>
      </section>
      <ThemeToggle />
    </main>
  );
}
