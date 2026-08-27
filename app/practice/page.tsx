import Link from "next/link";
import { ArrowRight, Layers, Sparkles } from "lucide-react";
import { getVerifiedUser } from "@/lib/supabase/server";

export default async function PracticeLauncherPage() {
  const { supabase, user } = await getVerifiedUser();
  const userId = user?.id;

  const [scenarioAttempts, generalAttempts] = userId
    ? await Promise.all([
        supabase.from("scenario_quiz_attempts").select("id", { count: "exact", head: true }).eq("user_id", userId),
        supabase.from("general_quiz_attempts").select("id", { count: "exact", head: true }).eq("user_id", userId),
      ])
    : [{ count: 0 }, { count: 0 }];

  const scenarioCount = scenarioAttempts.count ?? 0;
  const generalCount = generalAttempts.count ?? 0;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 py-8 sm:px-8 sm:py-12">
      <div className="topline"><span className="datechip">Practice</span></div>
      <header>
        <h1 className="display">How do you want to practice?</h1>
        <p className="lede">Work through a scenario-based problem, or jump into today&apos;s quiz.</p>
      </header>

      <section className="stack" style={{ gap: 10, marginTop: 22 }}>
        <Link href="/practice/scenario-quiz" className="panel-link outline bold-bounce group">
          <span className="panel-link-blob" aria-hidden="true" />
          <div className="panel-link-icon">
            <Layers className="size-5" aria-hidden="true" />
          </div>
          <div className="panel-link-text">
            <h2>Scenario Based Question</h2>
            <p className="panel-lede">
              Solve a real-world client problem and choose the best approach.
              {scenarioCount > 0 ? ` ${scenarioCount} attempt${scenarioCount === 1 ? "" : "s"} so far.` : ""}
            </p>
            <span className="panel-link-cta-pill">
              Start <ArrowRight size={13} aria-hidden="true" />
            </span>
          </div>
        </Link>
        <Link href="/practice/general" className="panel-link outline bold-bounce group">
          <span className="panel-link-blob" aria-hidden="true" />
          <div className="panel-link-icon">
            <Sparkles className="size-5" aria-hidden="true" />
          </div>
          <div className="panel-link-text">
            <h2>Quiz</h2>
            <p className="panel-lede">
              Test your understanding of concepts with quick questions.
              {generalCount > 0 ? ` ${generalCount} attempt${generalCount === 1 ? "" : "s"} so far.` : ""}
            </p>
            <span className="panel-link-cta-pill">
              Start <ArrowRight size={13} aria-hidden="true" />
            </span>
          </div>
        </Link>
      </section>
    </main>
  );
}
