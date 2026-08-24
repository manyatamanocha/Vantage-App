import { redirect } from "next/navigation";
import { getVerifiedUser } from "@/lib/supabase/server";
import { HomeDashboard } from "@/components/home-dashboard";

export default async function Home() {
  const { user } = await getVerifiedUser();
  if (!user) redirect("/login");

  return <HomeDashboard />;
}
