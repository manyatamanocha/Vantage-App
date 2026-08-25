import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getVerifiedUser } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

type ReviewStatus = "pending" | "approved" | "rejected";

async function setStatus(formData: FormData) {
  "use server";
  const { user } = await getVerifiedUser();
  if (!user?.id) redirect("/login");
  const table = String(formData.get("table") ?? "");
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as ReviewStatus;
  if (table !== "daily_quiz_questions" && table !== "practice_cases") return;
  if (!["approved", "rejected"].includes(status)) return;
  await getSupabaseAdminClient().from(table).update({ review_status: status }).eq("id", id);
  revalidatePath("/admin/quiz-review");
}

async function flagQuestion(formData: FormData) {
  "use server";
  const { user } = await getVerifiedUser();
  if (!user?.id) redirect("/login");
  const id = String(formData.get("id") ?? "");
  await getSupabaseAdminClient().from("daily_quiz_questions").update({ flagged: true }).eq("id", id);
  revalidatePath("/admin/quiz-review");
}

async function flagCase(formData: FormData) {
  "use server";
  const { user } = await getVerifiedUser();
  if (!user?.id) redirect("/login");
  const id = String(formData.get("id") ?? "");
  await getSupabaseAdminClient().from("practice_cases").update({ flagged: true }).eq("id", id);
  revalidatePath("/admin/quiz-review");
}

function ReviewButtons({ table, id }: { table: "daily_quiz_questions" | "practice_cases"; id: string }) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <form action={setStatus}>
        <input type="hidden" name="table" value={table} />
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="status" value="approved" />
        <button className="btn btn-primary" type="submit">Approve</button>
      </form>
      <form action={setStatus}>
        <input type="hidden" name="table" value={table} />
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="status" value="rejected" />
        <button className="btn btn-secondary" type="submit">Reject</button>
      </form>
    </div>
  );
}

export default async function QuizReviewPage() {
  const { user } = await getVerifiedUser();
  if (!user?.id) redirect("/login");
  const admin = getSupabaseAdminClient();
  const [{ data: questions }, { data: cases }] = await Promise.all([
    admin
      .from("daily_quiz_questions")
      .select("id, pool_date, difficulty, term, question_text, flagged, review_status")
      .order("review_status")
      .order("pool_date", { ascending: false })
      .order("difficulty"),
    admin
      .from("practice_cases")
      .select("id, raw_input, industry, difficulty, flagged, review_status")
      .order("review_status")
      .order("difficulty"),
  ]);

  const pendingQuestions = (questions ?? []).filter((q) => q.review_status === "pending");
  const decidedQuestions = (questions ?? []).filter((q) => q.review_status !== "pending");
  const pendingCases = (cases ?? []).filter((c) => c.review_status === "pending");
  const decidedCases = (cases ?? []).filter((c) => c.review_status !== "pending");

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-5 py-8 sm:px-8 sm:py-12">
      <header>
        <div className="topline"><span className="datechip">Admin</span></div>
        <h1 className="display">Quiz review</h1>
        <p className="lede">Newly generated content starts Pending and is not served until Approved. Anything already live can still be Flagged to pull it.</p>
      </header>

      <section className="stack">
        <span className="card-label">Jargon questions — pending review ({pendingQuestions.length})</span>
        <div className="card">
          {pendingQuestions.length === 0 ? <p className="card-text">Nothing waiting on review.</p> : null}
          {pendingQuestions.map((question) => (
            <div className="history-row" key={question.id}>
              <div className="flex-1">
                <strong>{question.term}</strong>
                <p className="mt-1 text-sm text-muted-foreground">{question.difficulty} · {question.question_text}</p>
              </div>
              <ReviewButtons table="daily_quiz_questions" id={question.id} />
            </div>
          ))}
        </div>
      </section>

      <section className="stack">
        <span className="card-label">Scenario cases — pending review ({pendingCases.length})</span>
        <div className="card">
          {pendingCases.length === 0 ? <p className="card-text">Nothing waiting on review.</p> : null}
          {pendingCases.map((item) => (
            <div className="history-row" key={item.id}>
              <div className="flex-1">
                <strong>{item.industry ?? "Scenario"}</strong>
                <p className="mt-1 text-sm text-muted-foreground">{item.difficulty} · {item.raw_input}</p>
              </div>
              <ReviewButtons table="practice_cases" id={item.id} />
            </div>
          ))}
        </div>
      </section>

      <section className="stack">
        <span className="card-label">Jargon questions — decided</span>
        <div className="card">
          {decidedQuestions.map((question) => (
            <div className="history-row" key={question.id}>
              <div className="flex-1">
                <strong>{question.term}</strong>
                <p className="mt-1 text-sm text-muted-foreground">{question.difficulty} · {question.question_text}</p>
              </div>
              {question.flagged ? (
                <span className="badge missed">Flagged — excluded</span>
              ) : question.review_status === "rejected" ? (
                <span className="badge missed">Rejected</span>
              ) : (
                <form action={flagQuestion}>
                  <input type="hidden" name="id" value={question.id} />
                  <button className="btn btn-secondary" type="submit">Flag</button>
                </form>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="stack">
        <span className="card-label">Scenario cases — decided</span>
        <div className="card">
          {decidedCases.map((item) => (
            <div className="history-row" key={item.id}>
              <div className="flex-1">
                <strong>{item.industry ?? "Scenario"}</strong>
                <p className="mt-1 text-sm text-muted-foreground">{item.difficulty} · {item.raw_input}</p>
              </div>
              {item.flagged ? (
                <span className="badge missed">Flagged — excluded</span>
              ) : item.review_status === "rejected" ? (
                <span className="badge missed">Rejected</span>
              ) : (
                <form action={flagCase}>
                  <input type="hidden" name="id" value={item.id} />
                  <button className="btn btn-secondary" type="submit">Flag</button>
                </form>
              )}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
