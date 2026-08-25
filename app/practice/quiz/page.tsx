import Link from "next/link";
import { redirect } from "next/navigation";
import { getVerifiedUser } from "@/lib/supabase/server";
import { BookOpen, Sparkles } from "lucide-react";

export default async function QuizPickerPage() {
  const { user } = await getVerifiedUser();
  if (!user?.id) redirect("/login");
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 py-8 sm:px-8 sm:py-12">
      <div className="topline"><span className="datechip">Quiz</span></div>
      <header>
        <h1 className="display">Which quiz?</h1>
        <p className="lede">Match a definition to a term, or test general tech &amp; AI knowledge.</p>
      </header>
      <section className="grid-2">
        <Link href="/practice/jargon" className="panel-link outline group">
          <Sparkles className="icon size-7" aria-hidden="true" />
          <h2>Term Quiz</h2>
          <p className="panel-lede">Which term means: [definition]? Test your understanding of concepts.</p>
        </Link>
        <Link href="/practice/general" className="panel-link outline group">
          <BookOpen className="icon size-7" aria-hidden="true" />
          <h2>Tech &amp; AI Quiz</h2>
          <p className="panel-lede">120 general knowledge questions on everyday tech and AI.</p>
        </Link>
      </section>
    </main>
  );
}
