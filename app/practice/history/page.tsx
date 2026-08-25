import Link from "next/link";
import { redirect } from "next/navigation";
import { Check, X } from "lucide-react";
import { getVerifiedUser } from "@/lib/supabase/server";
import { listSolves } from "./actions";
import { getProfile } from "@/app/settings/profile-actions";

const SOURCE_LABEL: Record<"live" | "practice", string> = {
  live: "Problem solving",
  practice: "Daily practice",
};

/**
 * The history screen (2j) renders every solve — live and practice — tagged
 * with its category and Correct/Missed status. `listSolves`'s declared return
 * type says `revealedCategory`/`correct` are always present, but a draft solve
 * abandoned before reveal (Task 4 creates the row on intake, before guess or
 * reveal happen) still has `revealed_category`/`correct` as NULL in the
 * database. This screen renders that as "In progress" rather than crashing or
 * printing "null"/"undefined".
 */
export default async function PracticeHistoryPage() {
  const { user } = await getVerifiedUser();
  if (!user?.id) redirect("/login");

  const [solves, profile] = await Promise.all([listSolves(user.id), getProfile()]);
  const completed = solves.filter((s) => s.correct !== null);
  const correctCount = completed.filter((s) => s.correct).length;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col px-5 py-8 sm:px-8 sm:py-12">
      <div className="topline"><span className="datechip">Your record</span></div>
      <header><h1 className="display">Practice history</h1><p className="lede">Your problem solving and daily practice, in one place.</p></header>

      <section className="card" style={{ marginTop: 16 }}>
        <span className="card-label">Performance record for</span>
        <p className="card-text" style={{ fontWeight: 650 }}>
          {profile.fullName || "Add your name in Settings"}
        </p>
        {completed.length > 0 ? (
          <div className="statrow">
            <span className="stat accent">{Math.round((correctCount / completed.length) * 100)}% first-guess accuracy</span>
            <span className="stat plain">{completed.length} attempt{completed.length === 1 ? "" : "s"}</span>
          </div>
        ) : null}
      </section>

      {solves.length === 0 ? (
        <div className="card" style={{ marginTop: 14, textAlign: "center", padding: "44px 24px" }}>
          <p className="card-text">Your score is waiting to climb — solve a problem or take a quiz.</p>
        </div>
      ) : (
        <ul className="card stack" style={{ marginTop: 20 }}>
          {solves.map((solve) => (
            <li key={solve.id} className="history-row">
              <Link href={`/solve/${solve.id}/summary`} className="meta" style={{ textDecoration: "none", color: "inherit" }}>
                <strong>{SOURCE_LABEL[solve.source] ?? solve.source}</strong>
                <span>{solve.revealedCategory ?? "Not revealed yet"}</span>
              </Link>
              {solve.correct === true ? (
                <span className="badge matched"><Check size={12} aria-hidden="true" /> Correct</span>
              ) : solve.correct === false ? (
                <span className="badge missed"><X size={12} aria-hidden="true" /> Missed</span>
              ) : (
                <span className="badge progress">In progress</span>
              )}
              <time dateTime={solve.createdAt}>
                {new Date(solve.createdAt).toLocaleDateString()}
              </time>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
