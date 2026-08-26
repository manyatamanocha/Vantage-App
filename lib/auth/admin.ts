import { redirect } from "next/navigation";
import { getVerifiedUser } from "@/lib/supabase/server";

// The admin surfaces (quiz review, analytics) previously only checked that a
// request was logged in, not that the logged-in user was an admin — anyone
// who signed up could approve/reject content or view user metrics. This is
// the single check both the pages and their server actions call so there is
// exactly one place that decides who counts as an admin.
export async function requireAdmin() {
  const { user } = await getVerifiedUser();
  if (!user?.id) redirect("/login");
  if (user.email !== process.env.ADMIN_EMAIL) redirect("/");
  return user;
}
