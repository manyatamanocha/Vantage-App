import { getTodaysPracticeCase } from "./actions";
import { PracticeSession } from "./practice-session";

/**
 * Rendering this page is now a pure read. The `solves` row is created by
 * `submitPracticeGuess` when the user actually locks in a guess — previously it
 * was created here on every render, so each reload of this URL left an orphan
 * draft behind in the user's history and progress data.
 */
export default async function PracticeTodayPage() {
  const practiceCase = await getTodaysPracticeCase();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-6">
      <PracticeSession
        practiceCaseId={practiceCase.id}
        rawInput={practiceCase.rawInput}
        difficulty={practiceCase.difficulty}
        matchedPreferredDifficulty={practiceCase.matchedPreferredDifficulty}
      />
    </main>
  );
}
