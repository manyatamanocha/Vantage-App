import { redirect } from "next/navigation";
import { getVerifiedUser } from "@/lib/supabase/server";
import { HomeDashboard } from "@/components/home-dashboard";

export default async function Home() {
  const { user } = await getVerifiedUser();
  if (!user) redirect("/login");

  const firstName =
    user.user_metadata.full_name?.split(" ")[0] ?? user.email?.split("@")[0] ?? "there";
  return <HomeDashboard firstName={firstName} />;
}
