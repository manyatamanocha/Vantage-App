import { getTodaysPracticeCase } from "./actions";
import { createDraftSolve } from "@/app/solve/new/actions";
import { PracticeSession } from "./practice-session";

// Each visit gets a fresh draft solve, mirroring the live flow's `source: "live"`
// draft created on intake — practice attempts are recorded the same way, tagged
// `source: "practice"`, so progress tracking (Feature elsewhere) sees one
// consistent `solves` table regardless of loop.
export default async function PracticeTodayPage() {
  const practiceCase = await getTodaysPracticeCase();
  const { solveId } = await createDraftSolve({
    rawInput: practiceCase.rawInput,
    industry: practiceCase.industry,
    source: "practice",
  });

  return (
    <main>
      <PracticeSession solveId={solveId} rawInput={practiceCase.rawInput} />
    </main>
  );
}
