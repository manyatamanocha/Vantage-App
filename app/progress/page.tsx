import { redirect } from "next/navigation";
import { getVerifiedUser } from "@/lib/supabase/server";
import { getProgressStats, getProgressSolves } from "./actions";
import { ProgressTrend } from "./progress-trend";

export default async function ProgressPage() {
  const { user } = await getVerifiedUser();
  if (!user?.id) redirect("/login");

  const stats = await getProgressStats(user.id);
  const solves = await getProgressSolves(user.id);

  const overallPercentage = Math.round(stats.firstGuessAccuracy * 100);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 py-8 sm:px-8 sm:py-12">
      <div className="topline"><span className="datechip">Your learning signal</span></div>
      <header><h1 className="display">Your Progress</h1></header>

      <section className="card">
        <span className="card-label">First-guess accuracy</span>
        <div className="metric-big">{overallPercentage}%</div>
        <p className="card-text" style={{ marginTop: 6 }}>
          {stats.completedCount === 0
            ? "No completed solves yet"
            : `Correct on first guess, across ${stats.completedCount} attempt${stats.completedCount === 1 ? "" : "s"}.`}
        </p>
      </section>

      <section className="stack">
        <span className="card-label">Accuracy trend</span>
        <ProgressTrend solves={solves} />
      </section>
    </main>
  );
}
