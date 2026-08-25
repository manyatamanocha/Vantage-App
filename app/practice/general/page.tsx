import { redirect } from "next/navigation";
import { getVerifiedUser } from "@/lib/supabase/server";
import { GeneralQuizSession } from "./general-quiz-session";

export default async function GeneralQuizPracticePage() {
  const { user } = await getVerifiedUser();
  if (!user?.id) redirect("/login");
  return <GeneralQuizSession />;
}
