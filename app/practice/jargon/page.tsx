import { redirect } from "next/navigation";
import { getVerifiedUser } from "@/lib/supabase/server";
import { JargonSession } from "./jargon-session";

export default async function JargonPracticePage() {
  const { user } = await getVerifiedUser();
  if (!user?.id) redirect("/login");
  return <JargonSession />;
}
