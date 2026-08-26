import { redirect } from "next/navigation";
import { getVerifiedUser } from "@/lib/supabase/server";
import { HomeDashboard } from "@/components/home-dashboard";
import { getSettings } from "@/app/settings/actions";

export default async function Home() {
  const { user } = await getVerifiedUser();
  if (!user) redirect("/login");

  // Home is the page everyone lands on after login — if
  // supabase/migrations/0007_default_question_type.sql hasn't been applied
  // yet, getSettings would throw on the missing column and take the whole
  // page down with it. Falling back to the scenario default here keeps Home
  // working either way; the real preference just doesn't take effect until
  // the migration is applied.
  const quizHref = await getSettings(user.id)
    .then((settings) => (settings.defaultQuestionType === "quiz" ? "/practice/general" : "/practice/today"))
    .catch(() => "/practice/today");

  return <HomeDashboard quizHref={quizHref} />;
}
