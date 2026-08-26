import { requireAdmin } from "@/lib/auth/admin";
import { listQuestions } from "./actions";
import { QuestionList } from "./question-list";
import { QuestionForm } from "./question-form";

export default async function AdminQuestionsPage() {
  await requireAdmin();
  const [general, scenario] = await Promise.all([
    listQuestions("general_quiz_questions"),
    listQuestions("scenario_quiz_questions"),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 py-8 sm:px-8 sm:py-12">
      <header>
        <div className="topline"><span className="datechip">Admin</span></div>
        <h1 className="display">Questions</h1>
        <p className="lede">Add, edit, or delete questions directly. Written here go live immediately.</p>
      </header>

      <section className="stack">
        <span className="card-label">Add a Tech &amp; AI quiz question</span>
        <QuestionForm table="general_quiz_questions" kind="general" />
      </section>

      <section className="stack">
        <span className="card-label">Tech &amp; AI quiz — {general.length} question{general.length === 1 ? "" : "s"}</span>
        <QuestionList table="general_quiz_questions" questions={general} kind="general" />
      </section>

      <section className="stack">
        <span className="card-label">Add a scenario quiz question</span>
        <QuestionForm table="scenario_quiz_questions" kind="scenario" />
      </section>

      <section className="stack">
        <span className="card-label">Scenario quiz — {scenario.length} question{scenario.length === 1 ? "" : "s"}</span>
        <QuestionList table="scenario_quiz_questions" questions={scenario} kind="scenario" />
      </section>
    </main>
  );
}
