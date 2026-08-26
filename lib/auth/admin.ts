import { redirect } from "next/navigation";
import { getVerifiedUser } from "@/lib/supabase/server";

// The admin surfaces (quiz review, analytics) previously only checked that a
// request was logged in, not that the logged-in user was an admin — anyone
// who signed up could approve/reject content or view user metrics. This is
// the single check both the pages and their server actions call so there is
// exactly one place that decides who counts as an admin.
//
// Role lives in app_metadata, not user_metadata: app_metadata can only be
// written with the service-role key (scripts/assign-admin-role.py), never by
// a user's own client SDK — so a normal user has no way to self-promote.
// ADMIN_EMAIL still exists in .env.local, but only as input to that
// assignment script now; this check no longer reads it.
export async function requireAdmin() {
  const { user } = await getVerifiedUser();
  if (!user?.id) redirect("/login");
  if (user.app_metadata?.role !== "admin") redirect("/");
  return user;
}
