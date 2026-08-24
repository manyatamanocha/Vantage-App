import { redirect } from "next/navigation";
import { getVerifiedUser } from "@/lib/supabase/server";
import { getProgressStats } from "@/app/progress/actions";
import { HomeDashboard } from "@/components/home-dashboard";

export default async function Home() {
  const { user } = await getVerifiedUser();
  if (!user) redirect("/login");

  const stats = await getProgressStats(user.id);
  const firstName =
    user.user_metadata.full_name?.split(" ")[0] ?? user.email?.split("@")[0] ?? "there";
  const today = new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date());

  return (
    <HomeDashboard
      firstName={firstName}
      today={today}
      firstGuessAccuracy={stats.firstGuessAccuracy}
      completedCount={stats.completedCount}
    />
  );
}
