import Link from "next/link";
import { redirect } from "next/navigation";
import { getVerifiedUser } from "@/lib/supabase/server";
import { Compass, MessageSquareText } from "lucide-react";

export default async function ScenarioPickerPage() {
  const { user } = await getVerifiedUser();
  if (!user?.id) redirect("/login");
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 py-8 sm:px-8 sm:py-12">
      <div className="topline"><span className="datechip">Scenario Based Question</span></div>
      <header>
        <h1 className="display">Which scenario practice?</h1>
        <p className="lede">Work a live problem against the real taxonomy, or run through the fixed-answer scenario bank.</p>
      </header>
      <section className="grid-2">
        <Link href="/practice/today" className="panel-link outline group">
          <Compass className="icon size-7" aria-hidden="true" />
          <h2>Live Scenario</h2>
          <p className="panel-lede">Guess the AI approach for a fresh client problem, then see the reveal.</p>
        </Link>
        <Link href="/practice/scenario-quiz" className="panel-link outline group">
          <MessageSquareText className="icon size-7" aria-hidden="true" />
          <h2>Scenario Quiz</h2>
          <p className="panel-lede">90 work scenarios with a suggested approach and explanation.</p>
        </Link>
      </section>
    </main>
  );
}
