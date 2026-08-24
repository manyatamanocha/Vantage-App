import Link from "next/link";
import { redirect } from "next/navigation";
import { getVerifiedUser } from "@/lib/supabase/server";
import { listSolves } from "./actions";

const SOURCE_LABEL: Record<"live" | "practice", string> = {
  live: "Live",
  practice: "Practice",
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

  const solves = await listSolves(user.id);

  return (
    <main>
      <h1>Practice history</h1>

      {solves.length === 0 ? (
        <p>Nothing here yet — solve a problem or try today&apos;s practice case.</p>
      ) : (
        <ul>
          {solves.map((solve) => {
            const status =
              solve.correct === true
                ? "Correct"
                : solve.correct === false
                  ? "Missed"
                  : "In progress";

            return (
              <li key={solve.id}>
                {/*
                  The summary screen is keyed only on the `solveId` route param
                  — it re-renders whatever `runRevealStep`/`submitPracticeGuess`
                  already persisted and never re-runs the model, so it is a
                  valid destination for a solve completed days ago. It also has
                  its own guard for a row that never reached reveal, which is
                  exactly the "In progress" case below.
                */}
                <Link href={`/solve/${solve.id}/summary`}>
                  <span>{SOURCE_LABEL[solve.source] ?? solve.source}</span>
                  {" — "}
                  <span>{solve.revealedCategory ?? "Not revealed yet"}</span>
                  {" — "}
                  <strong>{status}</strong>
                  {" — "}
                  <time dateTime={solve.createdAt}>
                    {new Date(solve.createdAt).toLocaleDateString()}
                  </time>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
