import Link from "next/link";
import { Bot, BriefcaseBusiness } from "lucide-react";
import { LiveClock } from "@/components/live-clock";
import { Greeting } from "@/components/greeting";

export function HomeDashboard() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 py-8 sm:px-8 sm:py-12">
      <section className="topline">
        <div>
          <h1 className="font-heading text-[22px] font-bold tracking-tight">
            <Greeting />
          </h1>
          <p className="lede">Build sharper instincts for matching client problems to the right AI approach.</p>
        </div>
        <LiveClock />
      </section>
      <section className="grid-2">
        <Link href="/solve/new" className="panel-link outline group">
          <BriefcaseBusiness className="icon size-7" aria-hidden="true" />
          <h2>What are we solving today?</h2>
          <p className="panel-lede">What&apos;s in your mind. Lets Solve</p>
        </Link>
        <Link href="/practice/jargon" className="panel-link outline group">
          <Bot className="icon size-7" aria-hidden="true" />
          <h2>Quiz time</h2>
          <p className="panel-lede">Daily Quizes and Challenges your away</p>
        </Link>
      </section>
    </main>
  );
}
