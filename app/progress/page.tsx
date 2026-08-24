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
    <main>
      <h1>Progress</h1>

      <section>
        <h2>Overall Accuracy</h2>
        <div className="accuracy-display">
          <div className="large-number">{overallPercentage}%</div>
          <p>
            {stats.completedCount === 0
              ? "No completed solves yet"
              : `Correct on first guess`}
          </p>
        </div>
      </section>

      <section>
        <h2>Accuracy by Category</h2>
        {Object.keys(stats.byCategory).length === 0 ? (
          <p>No data yet</p>
        ) : (
          <div className="category-breakdown">
            {Object.entries(stats.byCategory)
              .sort(([catA], [catB]) => catA.localeCompare(catB))
              .map(([category, accuracy]) => (
                <div key={category} className="category-item">
                  <span className="category-name">{category}</span>
                  <span className="category-accuracy">
                    {Math.round(accuracy * 100)}%
                  </span>
                </div>
              ))}
          </div>
        )}
      </section>

      <section>
        <h2>Weekly Trend</h2>
        <ProgressTrend solves={solves} />
      </section>
    </main>
  );
}
