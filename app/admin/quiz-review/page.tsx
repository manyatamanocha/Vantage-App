import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getVerifiedUser } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

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

export default async function QuizReviewPage() {
  const { user } = await getVerifiedUser();
  if (!user?.id) redirect("/login");
  const admin = getSupabaseAdminClient();
  const [{ data: questions }, { data: cases }] = await Promise.all([
    admin.from("daily_quiz_questions").select("id, pool_date, difficulty, term, question_text, flagged").order("pool_date", { ascending: false }).order("difficulty"),
    admin.from("practice_cases").select("id, raw_input, industry, difficulty, flagged").order("difficulty"),
  ]);
  return <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-5 py-8 sm:px-8 sm:py-12">
    <header><div className="topline"><span className="datechip">Admin</span></div><h1 className="display">Quiz review</h1><p className="lede">Flag anything that should leave the practice pool. Flagged items remain visible here but are not served.</p></header>
    <section className="stack"><span className="card-label">Jargon questions</span><div className="card">{(questions ?? []).map((question) => <div className="history-row" key={question.id}><div className="flex-1"><strong>{question.term}</strong><p className="mt-1 text-sm text-muted-foreground">{question.difficulty} · {question.question_text}</p></div>{question.flagged ? <span className="badge missed">Flagged — excluded</span> : <form action={flagQuestion}><input type="hidden" name="id" value={question.id} /><button className="btn btn-secondary" type="submit">Flag</button></form>}</div>)}</div></section>
    <section className="stack"><span className="card-label">Scenario cases</span><div className="card">{(cases ?? []).map((item) => <div className="history-row" key={item.id}><div className="flex-1"><strong>{item.industry ?? "Scenario"}</strong><p className="mt-1 text-sm text-muted-foreground">{item.difficulty} · {item.raw_input}</p></div>{item.flagged ? <span className="badge missed">Flagged — excluded</span> : <form action={flagCase}><input type="hidden" name="id" value={item.id} /><button className="btn btn-secondary" type="submit">Flag</button></form>}</div>)}</div></section>
  </main>;
}
