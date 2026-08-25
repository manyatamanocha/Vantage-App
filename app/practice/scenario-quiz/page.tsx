import { redirect } from "next/navigation";
import { getVerifiedUser } from "@/lib/supabase/server";
import { ScenarioQuizSession } from "./scenario-quiz-session";

export default async function ScenarioQuizPracticePage() {
  const { user } = await getVerifiedUser();
  if (!user?.id) redirect("/login");
  return <ScenarioQuizSession />;
}
