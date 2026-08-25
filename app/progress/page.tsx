import { redirect } from "next/navigation";
import { Target, MessageCircleQuestion } from "lucide-react";
import { getVerifiedUser } from "@/lib/supabase/server";
import { getProgressStats, getProgressSolves, getQuizStats } from "./actions";
import { ProgressTrend } from "./progress-trend";
import { StatTile } from "@/components/stat-tile";

export default async function ProgressPage() {
  const { user } = await getVerifiedUser();
  if (!user?.id) redirect("/login");

  const stats = await getProgressStats(user.id);
  const solves = await getProgressSolves(user.id);
  const quizStats = await getQuizStats(user.id);

  const overallPercentage = Math.round(stats.firstGuessAccuracy * 100);
  const quizPercentage = Math.round(quizStats.accuracy * 100);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 py-8 sm:px-8 sm:py-12">
      <header><h1 className="display">Your Progress</h1></header>

      <section className="compare-grid">
        <StatTile
          icon={Target}
          color="var(--primary)"
          label="First-guess accuracy"
          percentage={overallPercentage}
          subtext={
            stats.completedCount === 0
              ? "No completed solves yet"
              : `Across ${stats.completedCount} attempt${stats.completedCount === 1 ? "" : "s"}`
          }
        />
        <StatTile
          icon={MessageCircleQuestion}
          color="#EC4899"
          label="Quiz accuracy"
          percentage={quizPercentage}
          subtext={
            quizStats.attemptCount === 0
              ? "No quiz attempts yet"
              : `Across ${quizStats.attemptCount} question${quizStats.attemptCount === 1 ? "" : "s"}`
          }
        />
      </section>

      <section className="stack">
        <span className="card-label">Accuracy trend</span>
        <ProgressTrend solves={solves} />
      </section>
    </main>
  );
}
